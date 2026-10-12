import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ROLE_LABEL } from '../utils';

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const links = [{ to: '/', label: 'Dashboard', end: true }];
  if (user.role === 'EMPLOYEE') {
    links.push({ to: '/vouchers', label: 'My vouchers', end: true }, { to: '/vouchers/new', label: 'Create voucher' });
  } else {
    if (user.role === 'DIRECTOR') links.push({ to: '/pending', label: 'Pending approvals' });
    links.push({ to: '/vouchers', label: 'All vouchers', end: true });
  }
  links.push({ to: '/profile', label: 'My signature' });

  return (
    <>
      <header className="topbar no-print">
        <div className="brand">Expense Vouchers</div>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>{l.label}</NavLink>
          ))}
        </nav>
        <div className="user">
          <span>{user.name} <small>{ROLE_LABEL[user.role]}</small></span>
          <button className="btn btn-ghost" onClick={() => { logout(); nav('/login'); }}>Log out</button>
        </div>
      </header>
      <main className="page"><Outlet /></main>
    </>
  );
}
