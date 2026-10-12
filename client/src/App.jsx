import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import VoucherList from './pages/VoucherList';
import VoucherForm from './pages/VoucherForm';
import VoucherDetails from './pages/VoucherDetails';
import Profile from './pages/Profile';
import { useAuth } from './auth';

function Vouchers() {
  const { user } = useAuth();
  return <VoucherList title={user.role === 'EMPLOYEE' ? 'My vouchers' : 'All vouchers'} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="vouchers" element={<Vouchers />} />
          <Route path="vouchers/:id" element={<VoucherDetails />} />
          <Route path="profile" element={<Profile />} />
          <Route element={<ProtectedRoute roles={['EMPLOYEE']} />}>
            <Route path="vouchers/new" element={<VoucherForm />} />
            <Route path="vouchers/:id/edit" element={<VoucherForm />} />
          </Route>
          <Route element={<ProtectedRoute roles={['DIRECTOR']} />}>
            <Route path="pending" element={<VoucherList key="pending" title="Pending approvals" fixedStatus="Pending Approval" />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
