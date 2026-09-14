import { createBrowserRouter } from "react-router-dom";
import { BoardScreen } from "compositions/screens/board";
import { RouteError } from "./route-error/route-error";

export const appRouter = createBrowserRouter([
  {
    path: "*",
    Component: BoardScreen,
    errorElement: <RouteError />,
  },
]);
