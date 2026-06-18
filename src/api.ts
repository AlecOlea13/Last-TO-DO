import axios from "axios";

export const api = axios.create({
    baseURL: "https://pipsa-back.vercel.app/api",
});

export function setAuth(token: string | null) {
    if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    else delete api.defaults.headers.common["Authorization"];
}

setAuth(localStorage.getItem("token"));

let sesionExpiradaMostrada = false;

api.interceptors.response.use(
    (r) => r,
    (err) => {
        if (err.response?.status === 401 && !sesionExpiradaMostrada) {
            sesionExpiradaMostrada = true;
            localStorage.removeItem("token");
            localStorage.removeItem("rol");
            localStorage.removeItem("nombre");
            setAuth(null);
            alert("⏱️ Tu sesión ha expirado. Por favor inicia sesión nuevamente.");
            window.location.href = "/login";
        }
        return Promise.reject(err);
    }
);