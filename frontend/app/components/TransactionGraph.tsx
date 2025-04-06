'use client';

import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Transaction {
  amount: number;
  date: string;
  categories: string[];
  name: string;
}

interface TransactionGraphProps {
    userId: string;
}

export default function TransactionGraph({ userId }: TransactionGraphProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState('all');

  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Add temporary date states
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);

  // Add these helper functions at the top of your component
  const getMonthDateRange = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // Add this state for current month
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Add these handlers
  const handlePreviousMonth = () => {
    const newMonth = new Date(currentMonth.setMonth(currentMonth.getMonth() - 1));
    setCurrentMonth(newMonth);
    const range = getMonthDateRange(newMonth);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const handleNextMonth = () => {
    const newMonth = new Date(currentMonth.setMonth(currentMonth.getMonth() + 1));
    setCurrentMonth(newMonth);
    const range = getMonthDateRange(newMonth);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = sessionStorage.getItem('token');
        const response = await fetch(
          `http://localhost:3002/fetch-transactions?userId=${userId}&startDate=${startDate}&endDate=${endDate}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.transactions.length === 0) {
            setError("No transactions available for this period.");
          }
          setTransactions(data.transactions);
        } else {
          setError('Failed to load transactions');
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setError('Failed to load transactions');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [userId, startDate, endDate]);

  // Initialize the date range in useEffect
  useEffect(() => {
    const range = getMonthDateRange(new Date());
    setStartDate(range.start);
    setEndDate(range.end);
  }, []); // Run once on component mount

  const processTransactions = () => {
    if (loading || !transactions || !transactions.length) return null;

    const uniqueCategories = Array.from(new Set(
      transactions
        .filter(t => t?.categories)
        .map(t => t.categories[0])
        .filter(Boolean)
    ));

    const transactionsByDateAndCategory = transactions.reduce((acc, transaction) => {
      const date = transaction.date;
      const mainCategory = transaction.categories[0];
      
      if (!acc[date]) {
        acc[date] = {};
        uniqueCategories.forEach(cat => {
          acc[date][cat] = 0;
        });
      }
      
      if (mainCategory) {
        acc[date][mainCategory] += transaction.amount;
      }
      
      return acc;
    }, {} as Record<string, Record<string, number>>);

    const sortedDates = Object.keys(transactionsByDateAndCategory).sort();

    const generateColor = (index: number) => {
      const hue = (index * 137.508) % 360;
      return `hsla(${hue}, 70%, 50%, 1)`;
    };

    const allDatasets = uniqueCategories.map((category, index) => ({
      label: category,
      data: sortedDates.map(date => 
        Math.abs(transactionsByDateAndCategory[date][category])
      ),
      borderColor: generateColor(index),
      backgroundColor: generateColor(index).replace('1)', '0.2)'),
      borderWidth: 2,
      tension: 0.3,
      fill: false,
    }));

    return {
      labels: sortedDates.map(date => {
        const [year, month, day] = date.split('-');
        return `${month}/${day}`;
      }),
      datasets: selectedCategory 
        ? allDatasets.filter(dataset => dataset.label === selectedCategory)
        : allDatasets,
      allDatasets,
      originalDates: sortedDates
    };
  };

  const handleCategorySelect = (category: string) => {
    if (selectedCategory === category) {
      setSelectedCategory(null);
      setViewMode('all');
    } else {
      setSelectedCategory(category);
      setViewMode('category');
    }
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
        onClick: (e: any, legendItem: any) => {
          const index = legendItem.datasetIndex;
          const category = chartData?.datasets[index].label;
          if (category) {
            handleCategorySelect(category);
          }
          e.stopPropagation();
        }
      },
      title: {
        display: true,
        text: 'Spending by Category',
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          label: function(context: any) {
            if (context.parsed.y === 0) return `${context.dataset.label}: $0`;
            return `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`;
          }
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Amount ($)',
        },
      },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    },
  };

  // Handler for applying date changes
  const handleApplyDates = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
  };

  // Update the getDateRange function to immediately apply the dates
  const handleDateRangeSelect = (range: 'week' | 'month' | '90days') => {
    const end = new Date();
    const start = new Date();
    
    switch (range) {
      case 'week':
        start.setDate(end.getDate() - 7);
        break;
      case 'month':
        start.setDate(end.getDate() - 30);
        break;
      case '90days':
        start.setDate(end.getDate() - 90);
        break;
    }
    
    // Immediately set both temp and actual dates
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    setTempStartDate(startStr);
    setTempEndDate(endStr);
    setStartDate(startStr);
    setEndDate(endStr);
  };

  // Update the date picker section
  const datePickerSection = (
    <div className="mb-6 flex justify-between items-center">
      <div className="flex gap-2">
        <button
          onClick={() => handleDateRangeSelect('week')}
          className="px-3 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-white transition-colors duration-200"
        >
          Last Week
        </button>
        <button
          onClick={() => handleDateRangeSelect('month')}
          className="px-3 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-white transition-colors duration-200"
        >
          Last 30 Days
        </button>
        <button
          onClick={() => handleDateRangeSelect('90days')}
          className="px-3 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-white transition-colors duration-200"
        >
          Last 90 Days
        </button>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handlePreviousMonth}
          disabled={loading}
          className="px-2 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-white transition-colors duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        
        <span className="text-white font-medium min-w-[200px] text-center">
          {formatMonthYear(currentMonth)}
        </span>
        
        <button
          onClick={handleNextMonth}
          disabled={loading || currentMonth >= new Date()}
          className={`px-2 py-1 rounded text-sm ${
            currentMonth >= new Date() 
              ? 'bg-gray-600 cursor-not-allowed' 
              : 'bg-gray-700 hover:bg-gray-600'
          } text-white transition-colors duration-200`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="w-full">
        {datePickerSection}
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-gray-400">Loading transactions...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        {datePickerSection}
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-red-500">{error}</div>
        </div>
      </div>
    );
  }

  const chartData = processTransactions();

  if (!chartData) {
    return (
      <div className="w-full">
        {datePickerSection}
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-gray-400">No transactions found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {datePickerSection}

      <div className="mb-4 flex flex-wrap justify-center gap-2">
        <button
          onClick={() => {
            setViewMode('all');
            setSelectedCategory(null);
          }}
          className={`px-3 py-1 rounded text-sm ${
            viewMode === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-700'
          }`}
        >
          All Categories
        </button>
        
        {chartData.allDatasets.map((dataset) => (
          <button
            key={dataset.label}
            onClick={() => handleCategorySelect(dataset.label)}
            className={`px-3 py-1 rounded text-sm ${
              selectedCategory === dataset.label ? 'text-white' : ''
            }`}
            style={{
              backgroundColor: selectedCategory === dataset.label 
                ? dataset.borderColor 
                : dataset.backgroundColor,
              borderWidth: 1,
              borderColor: dataset.borderColor
            }}
          >
            {dataset.label}
          </button>
        ))}
      </div>

      <div className="text-sm text-center mb-4 text-gray-400">
        {viewMode === 'all' 
          ? 'Click on a legend item or button to view a specific category' 
          : `Viewing all transactions for ${selectedCategory}`}
      </div>

      <div className="w-full h-[400px] relative">
        <Line 
          options={{
            ...chartOptions,
            maintainAspectRatio: false,
          }} 
          data={chartData}
        />
      </div>
      
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4 text-indigo-300">Recent Transactions</h3>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {transactions
            .filter(t => !selectedCategory || t.categories[0] === selectedCategory)
            .map((transaction, index) => (
              <div
                key={index}
                className="flex justify-between items-center p-3 bg-gray-800 rounded-lg"
              >
                <div>
                  <div className="text-white">{transaction.name}</div>
                  <div className="text-sm text-gray-400">
                    {transaction.categories?.join(', ')}
                  </div>
                </div>
                <div className="text-white font-medium">
                  ${Math.abs(transaction.amount).toFixed(2)}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
} 