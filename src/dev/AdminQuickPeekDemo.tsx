import { AdminQuickPeek } from '../components/AdminQuickPeek';
import { computeHealth, computeOverview } from '../engine/adminStats';
import { DEMO } from './adminDemo';

export function AdminQuickPeekDemo() {
  const o = computeOverview(DEMO.accounts, DEMO.devices, DEMO.events);
  const peek = {
    at: Date.now(), active1: o.active1, active7: o.active7, accounts: o.accounts, series1: o.series1, series7: o.series7,
    devices: o.devices30, installed: o.installed30, accuracy7: o.accuracy7, openHelp: 1, err24: 1,
    health: computeHealth(o, DEMO.devices, DEMO.errors, DEMO.help, null, null).slice(0, 3),
  };
  window.sessionStorage.setItem('mt_admin_peek', JSON.stringify(peek));
  return (
    <div className="p-4 max-w-md">
      <AdminQuickPeek />
    </div>
  );
}
