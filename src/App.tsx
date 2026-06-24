import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login        from "./pages/Login";
import Dashboard    from "./pages/Dashboard";
import Profile      from "./pages/Profile";
import Clientes     from "./pages/Clientes";
import Montacargas  from "./pages/Montacargas";
import Rentas       from "./pages/Rentas";
import Servicios    from "./pages/Servicios";
import Facturas     from "./pages/Facturas";
import Cotizaciones from "./pages/Cotizaciones";
import Asesores     from "./pages/Asesores";
import Usuarios     from "./pages/Usuarios";
import Almacen      from "./pages/Almacen";
import Gastos from "./pages/Gastos";
import CxC from "./pages/CxC"
import Proveedores from "./pages/Proveedores";
import Portales from "./pages/Portales";
import ProtectedRoute from "./routes/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>

          {/* Todos los roles incluyendo almacen */}
          <Route path="montacargas" element={<Montacargas />} />
          <Route path="servicios"   element={<Servicios />} />
          <Route path="almacen"     element={<Almacen />} />

          {/* Oficina, gerencia, developer */}
          <Route path="clientes" element={
            <ProtectedRoute roles={["developer","gerencia","oficina"]}><Clientes /></ProtectedRoute>
          } />
          <Route path="rentas" element={
            <ProtectedRoute roles={["developer","gerencia","oficina"]}><Rentas /></ProtectedRoute>
          } />
          <Route path="cotizaciones" element={
            <ProtectedRoute roles={["developer","gerencia","oficina"]}><Cotizaciones /></ProtectedRoute>
          } />
          <Route path="facturas" element={
            <ProtectedRoute roles={["developer","gerencia","oficina"]}><Facturas /></ProtectedRoute>
          } />
          <Route path="gastos" element={
            <ProtectedRoute roles={["developer","gerencia","oficina"]}><Gastos /></ProtectedRoute>} />

          {/* Solo developer */}
          <Route path="asesores" element={
            <ProtectedRoute roles={["developer"]}><Asesores /></ProtectedRoute>
          } />
          <Route path="usuarios" element={
            <ProtectedRoute roles={["developer"]}><Usuarios /></ProtectedRoute>
          } />
          <Route path="cxc" element={
            <ProtectedRoute roles={["developer","gerencia","oficina"]}><CxC /></ProtectedRoute>} />
                <Route path="proveedores" element={
            <ProtectedRoute roles={["developer","gerencia","oficina"]}><Proveedores /></ProtectedRoute>
          } />
        </Route>
        <Route path="portales" element={
          <ProtectedRoute roles={["developer","gerencia","oficina"]}><Portales /></ProtectedRoute>
        } />
         

        <Route path="/dashboard/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;