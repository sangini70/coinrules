import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Loader2, ShieldCheck, Ban, Plus, Trash2 } from 'lucide-react';

type ManagedUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  status: 'pending' | 'approved' | 'blocked';
  approved: boolean;
};

type ManagedCoin = {
  id: string;
  symbol: string;
  market: string;
  enabled: boolean;
  priority: number;
};

export function AdminPanel() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [coins, setCoins] = useState<ManagedCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [newCoin, setNewCoin] = useState({
    symbol: '',
    market: '',
    priority: 100,
  });

  useEffect(() => {
    let active = true;

    const loadAdminData = async () => {
      setLoading(true);

      try {
        const [userSnapshot, coinSnapshot] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'coins')),
        ]);

        if (!active) return;

        const nextUsers = userSnapshot.docs
          .map((userDoc) => {
            const data = userDoc.data();
            const status =
              data.status === 'approved' || data.status === 'blocked' ? data.status : 'pending';
            return {
              id: userDoc.id,
              email: typeof data.email === 'string' ? data.email : '',
              displayName: typeof data.displayName === 'string' ? data.displayName : '',
              role: data.role === 'admin' ? 'admin' : 'user',
              status,
              approved: data.approved === true || status === 'approved',
            } as ManagedUser;
          })
          .sort((left, right) => {
            const statusOrder = { pending: 0, approved: 1, blocked: 2 };
            return (
              statusOrder[left.status] - statusOrder[right.status] ||
              left.email.localeCompare(right.email)
            );
          });

        const nextCoins = coinSnapshot.docs
          .map((coinDoc) => {
            const data = coinDoc.data();
            return {
              id: coinDoc.id,
              symbol: typeof data.symbol === 'string' ? data.symbol : coinDoc.id,
              market: typeof data.market === 'string' ? data.market : `KRW-${coinDoc.id}`,
              enabled: data.enabled !== false,
              priority: typeof data.priority === 'number' ? data.priority : 100,
            } as ManagedCoin;
          })
          .sort((left, right) => left.priority - right.priority || left.symbol.localeCompare(right.symbol));

        setUsers(nextUsers);
        setCoins(nextCoins);
      } catch (error) {
        console.error('Failed to load admin data.', error);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadAdminData();

    return () => {
      active = false;
    };
  }, []);

  const pendingCount = useMemo(
    () => users.filter((user) => user.status === 'pending').length,
    [users],
  );
  const pendingUsers = useMemo(
    () => users.filter((user) => user.status === 'pending'),
    [users],
  );

  const updateUserStatus = async (userId: string, status: ManagedUser['status']) => {
    setSavingKey(`user:${userId}:${status}`);

    try {
      await setDoc(
        doc(db, 'users', userId),
        {
          status,
          approved: status === 'approved',
          approvedAt: status === 'approved' ? serverTimestamp() : null,
        },
        { merge: true },
      );

      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === userId
            ? { ...user, status, approved: status === 'approved' }
            : user,
        ),
      );
    } catch (error) {
      console.error('Failed to update user status.', error);
    } finally {
      setSavingKey(null);
    }
  };

  const updateCoin = async (coinId: string, updates: Partial<ManagedCoin>) => {
    setSavingKey(`coin:${coinId}`);

    try {
      const currentCoin = coins.find((coin) => coin.id === coinId);
      if (!currentCoin) return;

      const nextCoin = { ...currentCoin, ...updates };
      await setDoc(
        doc(db, 'coins', coinId),
        {
          symbol: nextCoin.symbol,
          market: nextCoin.market,
          enabled: nextCoin.enabled,
          priority: nextCoin.priority,
        },
        { merge: true },
      );

      setCoins((prevCoins) =>
        prevCoins
          .map((coin) => (coin.id === coinId ? nextCoin : coin))
          .sort((left, right) => left.priority - right.priority || left.symbol.localeCompare(right.symbol)),
      );
    } catch (error) {
      console.error('Failed to update coin.', error);
    } finally {
      setSavingKey(null);
    }
  };

  const addCoin = async () => {
    const symbol = newCoin.symbol.trim().toUpperCase();
    const market = (newCoin.market.trim().toUpperCase() || `KRW-${symbol}`).replace(/\s+/g, '');
    if (!symbol) return;

    setSavingKey(`coin:new:${symbol}`);

    try {
      const nextCoin = {
        id: symbol,
        symbol,
        market,
        enabled: true,
        priority: Number.isFinite(newCoin.priority) ? newCoin.priority : 100,
      };

      await setDoc(doc(db, 'coins', symbol), {
        symbol: nextCoin.symbol,
        market: nextCoin.market,
        enabled: nextCoin.enabled,
        priority: nextCoin.priority,
      });

      setCoins((prevCoins) =>
        [...prevCoins.filter((coin) => coin.id !== symbol), nextCoin].sort(
          (left, right) => left.priority - right.priority || left.symbol.localeCompare(right.symbol),
        ),
      );
      setNewCoin({ symbol: '', market: '', priority: 100 });
    } catch (error) {
      console.error('Failed to add coin.', error);
    } finally {
      setSavingKey(null);
    }
  };

  const removeCoin = async (coinId: string) => {
    setSavingKey(`coin:delete:${coinId}`);

    try {
      await deleteDoc(doc(db, 'coins', coinId));
      setCoins((prevCoins) => prevCoins.filter((coin) => coin.id !== coinId));
    } catch (error) {
      console.error('Failed to remove coin.', error);
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-card-bg border border-text-main/5 p-10 flex items-center justify-center gap-3">
        <Loader2 size={18} className="animate-spin text-text-main" />
        <span className="text-sm font-bold text-text-muted/70">관리자 데이터를 불러오는 중입니다.</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="bg-card-bg border border-text-main/5 p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-text-muted/40">관리자</p>
            <h2 className="text-3xl font-black tracking-tight text-text-main uppercase">사용자 관리</h2>
          </div>
          <div className="px-4 py-2 border border-status-warn/20 bg-status-warn/5 text-status-warn text-[10px] font-black uppercase tracking-[0.18em]">
            승인 대기 {pendingCount}명
          </div>
        </div>
        {pendingUsers.length > 0 && (
          <div className="space-y-3 rounded border border-status-warn/20 bg-status-warn/5 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-status-warn">
              승인 대기
            </div>
            <div className="flex flex-wrap gap-2">
              {pendingUsers.map((user) => (
                <div key={user.id} className="flex items-center gap-2 rounded border border-status-warn/20 bg-card-bg px-3 py-2">
                  <span className="text-xs font-bold text-text-main">{user.email || user.id}</span>
                  <button
                    type="button"
                    onClick={() => void updateUserStatus(user.id, 'approved')}
                    disabled={savingKey === `user:${user.id}:approved`}
                    className="px-2 py-1 border border-status-safe/20 bg-status-safe/5 text-status-safe text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                  >
                    승인
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-px bg-text-main/5 border border-text-main/5">
          <div className="bg-aux-bg p-4 grid grid-cols-[2fr_1fr_1fr_auto] gap-4 text-[9px] font-black uppercase tracking-widest text-text-muted/30">
            <div>이메일</div>
            <div>이름</div>
            <div>상태</div>
            <div>관리</div>
          </div>
          {users.map((user) => (
            <div key={user.id} className="bg-card-bg p-4 grid grid-cols-[2fr_1fr_1fr_auto] gap-4 items-center">
              <div className="text-sm font-bold text-text-main">{user.email || user.id}</div>
              <div className="text-xs text-text-muted/70">{user.displayName || '-'}</div>
              <div className="text-xs font-black uppercase tracking-widest text-text-muted/60">
                {user.status}
                {user.role === 'admin' && <span className="ml-2 text-status-safe">관리자</span>}
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => void updateUserStatus(user.id, 'approved')}
                  disabled={savingKey === `user:${user.id}:approved`}
                  className="px-3 py-2 border border-status-safe/20 bg-status-safe/5 text-status-safe text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                >
                  승인
                </button>
                <button
                  type="button"
                  onClick={() => void updateUserStatus(user.id, 'blocked')}
                  disabled={savingKey === `user:${user.id}:blocked`}
                  className="px-3 py-2 border border-status-danger/20 bg-status-danger/5 text-status-danger text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                >
                  차단
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card-bg border border-text-main/5 p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-text-muted/40">관리자</p>
            <h2 className="text-3xl font-black tracking-tight text-text-main uppercase">코인 관리</h2>
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-text-muted/40">
            {coins.length}개 등록
          </div>
        </div>

        <div className="grid md:grid-cols-[1fr_1fr_140px_auto] gap-3">
          <input
            value={newCoin.symbol}
            onChange={(event) => setNewCoin((prev) => ({ ...prev, symbol: event.target.value }))}
            placeholder="BTC"
            className="bg-aux-bg border border-text-main/10 px-4 py-3 text-sm font-bold text-text-main outline-none"
          />
          <input
            value={newCoin.market}
            onChange={(event) => setNewCoin((prev) => ({ ...prev, market: event.target.value }))}
            placeholder="KRW-BTC"
            className="bg-aux-bg border border-text-main/10 px-4 py-3 text-sm font-bold text-text-main outline-none"
          />
          <input
            type="number"
            value={newCoin.priority}
            onChange={(event) =>
              setNewCoin((prev) => ({ ...prev, priority: Number(event.target.value || 0) }))
            }
            className="bg-aux-bg border border-text-main/10 px-4 py-3 text-sm font-bold text-text-main outline-none"
          />
          <button
            type="button"
            onClick={() => void addCoin()}
            disabled={!newCoin.symbol.trim()}
            className="px-4 py-3 border border-text-main/10 bg-text-main text-main-bg text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus size={14} />
            추가
          </button>
        </div>

        <div className="grid gap-px bg-text-main/5 border border-text-main/5">
          <div className="bg-aux-bg p-4 grid grid-cols-[1fr_2fr_120px_120px_auto] gap-4 text-[9px] font-black uppercase tracking-widest text-text-muted/30">
            <div>심볼</div>
            <div>마켓</div>
            <div>활성</div>
            <div>우선순위</div>
            <div>관리</div>
          </div>
          {coins.map((coin) => (
            <div key={coin.id} className="bg-card-bg p-4 grid grid-cols-[1fr_2fr_120px_120px_auto] gap-4 items-center">
              <div className="text-sm font-black text-text-main">{coin.symbol}</div>
              <div className="text-sm text-text-muted/70">{coin.market}</div>
              <label className="flex items-center gap-2 text-xs font-bold text-text-muted/70">
                <input
                  type="checkbox"
                  checked={coin.enabled}
                  onChange={(event) => void updateCoin(coin.id, { enabled: event.target.checked })}
                />
                {coin.enabled ? '활성' : '비활성'}
              </label>
              <input
                type="number"
                value={coin.priority}
                onChange={(event) => void updateCoin(coin.id, { priority: Number(event.target.value || 0) })}
                className="bg-aux-bg border border-text-main/10 px-3 py-2 text-sm font-bold text-text-main outline-none"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void removeCoin(coin.id)}
                  disabled={savingKey === `coin:delete:${coin.id}`}
                  className="px-3 py-2 border border-status-danger/20 bg-status-danger/5 text-status-danger text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
