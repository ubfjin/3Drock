import React, { Suspense, lazy, useEffect, useState } from 'react';
import { currentIdentity, demoMode, googleSignIn, loadClassroom, previewSignIn, signOut, teacherSignIn } from './data.js';

const Student = lazy(() => import('./Student.jsx'));
const Teacher = lazy(() => import('./Teacher.jsx'));

function Logo() { return <span className="logo"><span className="logo-stone">◆</span> ROCK<span>LAB</span></span>; }

function Landing({ identity, busy, error, onStudent, onTeacher, onStart, teacherOpen }) {
  const [code, setCode] = useState('');
  return <main className="landing">
    <section className="landing-hero"><div className="landing-hero-inner"><div className="landing-copy"><div className="overline">INTERACTIVE EARTH SCIENCE</div><h1><span className="headline-line">3D 암석 관찰과</span><span className="headline-line">탐구 <em>기록</em></span></h1><p>암석을 돌려 보고, 가까이 들여다보고,<br />관찰한 생각을 나만의 보고서로 남겨보세요.</p></div><div className="landing-art"><img src="/rock-hero.png" alt="어두운 회색 암석 시료" /></div></div></section>
    <section className="landing-entry"><button className="primary-button" disabled={busy} onClick={identity ? onStart : onStudent}>{identity?.role === 'teacher' ? '교사 대시보드 열기' : '활동 시작하기'} <span>→</span></button>
      {teacherOpen && !identity && <form className="teacher-login" onSubmit={(e) => { e.preventDefault(); onTeacher(code); }}><label htmlFor="teacher-code">교사 접근 코드</label><div><input id="teacher-code" type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="접근 코드를 입력하세요" autoComplete="off" disabled={busy} /><button type="submit" disabled={busy || !code.trim()}>입장 →</button></div></form>}
      {error && <p className="notice error" role="alert">{error}</p>}{demoMode && <p className="demo-note">미리보기 모드 · 작성 내용은 이 브라우저에만 저장됩니다.</p>}</section>
    <footer className="landing-footer">© ubfjin@snu.ac.kr <span>© 2026 RockLab</span></footer>
  </main>;
}

export default function App() {
  const [identity, setIdentity] = useState(null);
  const [screen, setScreen] = useState('home');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [teacherOpen, setTeacherOpen] = useState(false);
  useEffect(() => { currentIdentity().then(setIdentity).catch((e) => setError(e.message || '로그인 상태를 확인하지 못했습니다.')).finally(() => setBusy(false)); }, []);
  const refresh = async (who = identity) => { const next = await loadClassroom(who.role, who.user.id); setData(next); return next; };
  const start = async (who = identity) => {
    if (!who) return;
    setBusy(true); setError('');
    try { await refresh(who); setScreen(who.role === 'teacher' ? 'teacher' : 'student'); }
    catch (e) { setError(e.message || '활동을 시작하지 못했습니다.'); }
    finally { setBusy(false); }
  };
  const studentLogin = async () => {
    setBusy(true); setError('');
    try { const who = demoMode ? await previewSignIn('student') : await googleSignIn(); if (who) setIdentity(who); }
    catch (e) { setError(e.message || '로그인하지 못했습니다.'); }
    finally { setBusy(false); }
  };
  const teacherLogin = async (code) => {
    setBusy(true); setError('');
    try { const who = await teacherSignIn(code); setIdentity(who); await start(who); }
    catch (e) { setError(e.message || '교사 화면에 들어가지 못했습니다.'); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    setBusy(true);
    try { await signOut(); setIdentity(null); setData(null); setScreen('home'); setError(''); }
    catch (e) { setError(e.message || '로그아웃하지 못했습니다.'); }
    finally { setBusy(false); }
  };
  return <div className="app"><header className="site-header"><button className="header-logo" onClick={() => setScreen('home')}><Logo /></button><div className="header-right">{identity ? <><span className="header-user">{identity.role === 'teacher' ? '교사' : identity.user?.email || identity.user?.user_metadata?.full_name || '학생'}</span><button className="header-logout" onClick={logout}>로그아웃</button></> : screen === 'home' && <><button className="header-teacher" onClick={() => setTeacherOpen(!teacherOpen)}>교사 화면</button><button className="header-login" disabled={busy} onClick={studentLogin}>로그인</button></>}</div></header>
    {screen === 'home' && <Landing identity={identity} busy={busy} error={error} onStudent={studentLogin} onTeacher={teacherLogin} onStart={() => start()} teacherOpen={teacherOpen} />}
    <Suspense fallback={<div className="loading-page">학습 공간을 준비하는 중입니다…</div>}>
      {screen === 'student' && data && <Student identity={identity} data={data} onRefresh={() => refresh()} onHome={() => setScreen('home')} />}
      {screen === 'teacher' && data && <Teacher data={data} onRefresh={() => refresh()} />}
    </Suspense>
  </div>;
}
