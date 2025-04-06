import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("home/home.tsx"),
    route("login", "./login/login.tsx")



] satisfies RouteConfig;
