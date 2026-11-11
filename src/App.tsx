import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider, useApp } from "./lib/store";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Thread from "./pages/Thread";
import Profile from "./pages/Profile";
import Search from "./pages/Search";
import Notifications from "./pages/Notifications";
import Relays from "./pages/Relays";
import Toolbox from "./pages/Toolbox";
import Settings from "./pages/Settings";

function Gate({ children }: { children: React.ReactNode }) {
  const { signer } = useApp();
  if (!signer) return <Login />;
  return <>{children}</>;
}

function Shell() {
  return (
    <Routes>
      <Route path="/" element={<Gate><Layout /></Gate>}>
        <Route index element={<Home />} />
        <Route path="/thread/:id" element={<Thread />} />
        <Route path="/p/:npub" element={<Profile />} />
        <Route path="/search" element={<Search />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/relays" element={<Relays />} />
        <Route path="/toolbox" element={<Toolbox />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/tag/:tag" element={<Home />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AppProvider>
  );
}
