import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./login/loginpage";

const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  </BrowserRouter>
);