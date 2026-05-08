import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login        from "./pages/Login";
import Register     from "./pages/Register";
import Dashboard    from "./pages/Dashboard";
import Profile      from "./pages/Profile";
import VerifyEmail  from "./pages/VerifyEmail";
import Clientes     from "./pages/Clientes";
import Montacargas  from "./pages/Montacargas";
import Rentas       from "./pages/Rentas";
import Servicios    from "./pages/Servicios";
import Facturas     from "./pages/Facturas";
import ProtectedRoute from "./routes/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"             element={<Login />} />
        <Route path="/register"     element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        >
          <Route path="clientes"    element={<Clientes />} />
          <Route path="montacargas" element={<Montacargas />} />
          <Route path="rentas"      element={<Rentas />} />
          <Route path="servicios"   element={<Servicios />} />
          <Route path="facturas"    element={<Facturas />} />
        </Route>

        <Route
          path="/dashboard/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
