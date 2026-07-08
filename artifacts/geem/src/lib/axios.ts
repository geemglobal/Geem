import Axios from "axios";

export const axiosInstance = Axios.create({ baseURL: "/api" });
axiosInstance.interceptors.request.use(cfg => {
  if (!cfg.headers.Authorization) {
    const token = localStorage.getItem("geem_token");
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});
