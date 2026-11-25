import { Navigate, Route, Routes } from 'react-router';
import { Layout } from '../components/Layout.js';
import { AgentOrderPage } from '../routes/agent/AgentOrderPage.js';
import { AgentOrdersPage } from '../routes/agent/AgentOrdersPage.js';
import { AgentStockPage } from '../routes/agent/AgentStockPage.js';
import { LoginPage } from '../routes/LoginPage.js';
import { AgentsPage } from '../routes/manager/AgentsPage.js';
import { CreateOrderPage } from '../routes/manager/CreateOrderPage.js';
import { OrderDetailPage } from '../routes/manager/OrderDetailPage.js';
import { OrdersPage } from '../routes/manager/OrdersPage.js';
import { HomeRedirect, RequireAuth, RequireRole } from './guards.js';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<HomeRedirect />} />
          <Route element={<RequireRole role="MANAGER" />}>
            <Route path="/manager/orders" element={<OrdersPage />} />
            <Route path="/manager/orders/new" element={<CreateOrderPage />} />
            <Route path="/manager/orders/:id" element={<OrderDetailPage />} />
            <Route path="/manager/agents" element={<AgentsPage />} />
          </Route>
          <Route element={<RequireRole role="AGENT" />}>
            <Route path="/agent" element={<AgentOrdersPage />} />
            <Route path="/agent/orders/:id" element={<AgentOrderPage />} />
            <Route path="/agent/stock" element={<AgentStockPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
