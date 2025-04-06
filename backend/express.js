const express = require('express')
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const cors = require('cors')
const bcrypt = require('bcrypt'); // Add this dependency for password hashing
const jwt = require('jsonwebtoken'); // Add this for JWT tokens

const app = express()
app.use(cors())
app.use(express.json()); 
const port = 3002

const { PrismaClient } = require('@prisma/client');
const { access } = require('fs');

// First, add this middleware function near the top of your file, after the imports
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Function to process transactions in batches
async function processTransactionBatches() {
  try {
    // Find unprocessed transactions
    const unprocessedTransactions = await prisma.transaction.findMany({
      where: {
        isProcessed: false,
        processingBatchId: null
      },
      take: 50 // Process in batches of 50
    });

    if (unprocessedTransactions.length > 0) {
      // Create a new processing batch
      const batch = await prisma.processingBatch.create({
        data: {
          prompt: "Classify these transactions", // You can customize the prompt
          response: "", // Will be filled after processing
          status: "PENDING"
        }
      });

      // Update transactions to associate them with this batch
      await prisma.transaction.updateMany({
        where: {
          id: {
            in: unprocessedTransactions.map(t => t.id)
          }
        },
        data: {
          processingBatchId: batch.id
        }
      });

      console.log(`Created batch ${batch.id} with ${unprocessedTransactions.length} transactions`);
    }
  } catch (error) {
    console.error('Error processing transaction batch:', error);
  }
}

// Run the batch processor every 5 minutes
// setInterval(processTransactionBatches, 5 * 60 * 1000);


const prisma = new PrismaClient();
const configuration = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
    },
  });

  const plaidClient = new PlaidApi(configuration);

app.get('/', async (req, res) => {
    try {
        const val = await prisma.user.findFirst({});
        console.log(val)
        res.json({
          userId: val.id
        })
        // res.json({
        //     userId: 321
        // })
    } catch (error) {
        console.error('Error in root route:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/create-link-token', authenticateToken, async (req, res) => {
    try {
        const request = {
            user: { client_user_id: req.user.userId.toString() }, // Use the authenticated user's ID
            client_name: 'Your App Name',
            products: ['transactions'],
            country_codes: ['US'],
            language: 'en',
        };
        const createTokenResponse = await plaidClient.linkTokenCreate(request);
        console.log("HERE IS TOKEN")
        console.log(createTokenResponse.data.link_token)
        res.json({ link_token: createTokenResponse.data.link_token }); // Return JSON instead of plain text
    } catch (error) {
        console.error('Error creating link token:', error);
        res.status(500).json({ error: 'Failed to create link token' });
    }
});

app.get('/retrieve-plaid-user', authenticateToken, async (req, res) => {
    try {
        const userId = req.query.userId;
        const plaidAccount = await prisma.plaidAccount.findMany({
            where: { userId: userId }
        });
        res.json(plaidAccount);
    } catch (error) {
        console.error('Error retrieving plaid user:', error);
        res.status(500).json({ error: 'Failed to retrieve plaid user' });
    }
});

app.get('/get-transactions', async (req, res) => {
    try {
        const accessToken = req.query.accessToken;
        const lookBackDays = req.query.lookBack || 30;
        const now = new Date()
        const daysAgo = new Date(now.getTime() - lookBackDays * 24 * 60 * 60 * 1000);
        const response = await plaidClient.transactionsGet({
            access_token: accessToken,
            start_date: daysAgo.toISOString().split('T')[0],
            end_date: now.toISOString().split('T')[0],
        });
        console.log(response.data.transactions)
        res.json(response.data.transactions);
    } catch (error) {
        console.error('Error getting transactions:', error);
        res.status(500).json({ error: 'Failed to get transactions' });
    }
});

app.get('/fetch-transactions', authenticateToken, async (req, res) => {
    try {
        const userId = req.query.userId;
        // Parse dates and strip time components
        const requestedStartDate = req.query.startDate 
            ? new Date(req.query.startDate)
            : new Date(new Date().setDate(new Date().getDate() - 30)); // Default 30 days
        
        const requestedEndDate = req.query.endDate 
            ? new Date(req.query.endDate) 
            : new Date();
        
        // Strip time components to compare dates only
        requestedStartDate.setHours(0, 0, 0, 0);
        requestedEndDate.setHours(0, 0, 0, 0);

        if (!userId) {
            return res.status(404).json({ "message": "Error: No userId provided" });
        }

        const plaidAccounts = await prisma.plaidAccount.findMany({
            where: { userId: userId }
        });

        if (!plaidAccounts || plaidAccounts.length === 0) {
            return res.status(404).json({ "message": "Error: No account with userId found" });
        }

        let transactions = [];

        for (let account of plaidAccounts) {
            try {
                let needPlaidFetch = false;
                let fetchStartDate = requestedStartDate;
                let fetchEndDate = requestedEndDate;

                // Format stored dates for day-only comparison
                const storedFirstDate = account.firstTransactionDate ? 
                    new Date(account.firstTransactionDate) : null;
                const storedLastDate = account.lastTransactionDate ? 
                    new Date(account.lastTransactionDate) : null;
                
                if (storedFirstDate) storedFirstDate.setHours(0, 0, 0, 0);
                if (storedLastDate) storedLastDate.setHours(0, 0, 0, 0);

                // Check if we need to fetch from Plaid
                if (!storedFirstDate || !storedLastDate) {
                    needPlaidFetch = true;
                } else {
                    // Check if requested dates are outside our stored range (date comparison only)
                    if (requestedStartDate < storedFirstDate) {
                        needPlaidFetch = true;
                        fetchStartDate = requestedStartDate;
                    }
                    if (requestedEndDate > storedLastDate) {
                        needPlaidFetch = true;
                        fetchEndDate = requestedEndDate;
                    }
                }

                if (needPlaidFetch) {
                    console.log(`Fetching from Plaid for account ${account.id}, date range: ${fetchStartDate.toISOString().split('T')[0]} to ${fetchEndDate.toISOString().split('T')[0]}`);
                    
                    // Fetch from Plaid
                    const response = await plaidClient.transactionsGet({
                        access_token: account.accessToken,
                        start_date: fetchStartDate.toISOString().split('T')[0],
                        end_date: fetchEndDate.toISOString().split('T')[0],
                    });

                    // Process each transaction
                    for (const tx of response.data.transactions) {
                        await prisma.transaction.upsert({
                            where: {
                                transactionId: tx.transaction_id
                            },
                            update: {
                                amount: tx.amount,
                                date: tx.date,
                                name: tx.name,
                                merchantName: tx.merchant_name || null,
                                pending: tx.pending,
                                categories: tx.category || [],
                                updatedAt: new Date()
                            },
                            create: {
                                transactionId: tx.transaction_id,
                                plaidAccountId: account.id,
                                amount: tx.amount,
                                date: tx.date,
                                name: tx.name,
                                merchantName: tx.merchant_name || null,
                                pending: tx.pending,
                                categories: tx.category || [],
                                isProcessed: false
                            }
                        });
                    }

                    // Update account's transaction date range with date-only values
                    let newFirstDate = storedFirstDate;
                    let newLastDate = storedLastDate;

                    if (!storedFirstDate || fetchStartDate < storedFirstDate) {
                        newFirstDate = fetchStartDate;
                    }
                    if (!storedLastDate || fetchEndDate > storedLastDate) {
                        newLastDate = fetchEndDate;
                    }

                    await prisma.plaidAccount.update({
                        where: { id: account.id },
                        data: {
                            firstTransactionDate: newFirstDate,
                            lastTransactionDate: newLastDate
                        }
                    });

                    // transactions.push(...response.data.transactions);
                } 
                
                // else {
                    console.log(`Fetching from database for account ${account.id}, date range: ${requestedStartDate.toISOString().split('T')[0]} to ${requestedEndDate.toISOString().split('T')[0]}`);
                    
                    // Fetch from database
                    const dbTransactions = await prisma.transaction.findMany({
                        where: {
                            plaidAccountId: account.id,
                            date: {
                                gte: requestedStartDate.toISOString().split('T')[0],
                                lte: requestedEndDate.toISOString().split('T')[0]
                            }
                        }
                    });
                    transactions.push(...dbTransactions);
                // }
            } catch (innerError) {
                console.error(`Error processing account ${account.id}:`, innerError);
                continue;
            }
        }
        
        res.json({
            message: "Transactions fetched successfully",
            count: transactions.length,
            transactions: transactions,
            dateRange: {
                start: requestedStartDate.toISOString().split('T')[0],
                end: requestedEndDate.toISOString().split('T')[0]
            }
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

app.post('/exchange-save-token', authenticateToken, async (req, res) => {
  try {
    const { public_token, userId} = req.body;

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get institution details
    const itemResponse = await plaidClient.itemGet({
      access_token: accessToken,
    });

    let institutionId = itemResponse.data.item.institution_id;
    let accountName = "test";
    const institutionResponse = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: ['US'],
    });

    // res.json({accessToken: accessToken})
    const existingAccount = await prisma.plaidAccount.findUnique({
        where: { itemId: itemId },
    });

    if (existingAccount) {
        await prisma.plaidAccount.update({
            where: { itemId: itemId },
            data: {
                accessToken,
                itemId,
                institutionId,
                accountName,
            },
        });
    } else {
        await prisma.plaidAccount.create({
            data: {
                accessToken,
                itemId,
                institutionId,
                accountName,
                user: {
                    connect: {
                        id: userId // Connect to existing user by their ID
                    }
                }
            },
        });
    }

  res.json({ message: 'Access token saved successfully' });

    
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }

})


app.post('/save-access-token', async (req, res) => {
    try {
        const { userId, accessToken, itemId, institutionId, accountName } = req.body;

        if (!userId || !accessToken || !itemId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const existingAccount = await prisma.plaidAccount.findUnique({
            where: { id: userId },
        });

        if (existingAccount) {
            await prisma.plaidAccount.update({
                where: { userId },
                data: {
                    accessToken,
                    itemId,
                    institutionId,
                    accountName,
                },
            });
        } else {
            await prisma.plaidAccount.create({
                data: {
                    userId,
                    accessToken,
                    itemId,
                    institutionId,
                    accountName,
                },
            });
        }

        res.json({ message: 'Access token saved successfully' });
    } catch (error) {
        console.error('Error saving access token:', error);
        res.status(500).json({ error: 'Failed to save access token' });
    }
});

// Add these new endpoints for user authentication

// Create a new user account
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    
    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Create the user
    const newUser = await prisma.user.create({
      data: {
        password: hashedPassword,
        email: `${email}`, 
      }
    });
    
    // Create a JWT token
    const token = jwt.sign(
      { userId: newUser.id, username: newUser.email },
      process.env.JWT_SECRET || 'your-secret-key', // Use environment variable in production
      { expiresIn: '24h' }
    );
    
    // Return user info (excluding password) and token
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        email: newUser.email
      },
      token
    });
    
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    
    // Find the user
    const user = await prisma.user.findFirst({
      where: { 
          email: email 
      }
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Compare passwords
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Create a JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key', // Use environment variable in production
      { expiresIn: '24h' }
    );
    
    // Return user info and token
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email
      },
      token
    });
    
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})