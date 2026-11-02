import { BrowserRouter as Router } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AppRoutes } from "./routes/AppRoutes";
import { AuthProvider } from "./context/AuthContext";
import { BrandProvider } from "./context/BrandContext";
import { ErrorBoundary } from "./components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <BrandProvider>
            <Toaster position="top-right" />
            <AppRoutes />
          </BrandProvider>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
