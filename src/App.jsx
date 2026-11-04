import React, { Suspense, lazy, useEffect, useState } from 'react';
import { currentIdentity, demoMode, googleSignIn, loadClassroom, previewSignIn, signOut, teacherSignIn } from './data.js';

const Student = lazy(() => import('./Student.jsx'));
const Teacher = lazy(() => import('./Teacher.jsx'));

function Logo() { return <span className="logo"><span className="logo-stone">◆</span> ROCK<span>LAB</span><small>CLASSROOM</small></span>; }

function Landing({ identity, busy, error, onStudent, onTeacher, onStart }) {
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [code, setCode] = useState('');
  return <main className="landing">
    <div className="landing-copy"><div className="overline"><span className="dot" /> INTERACTIVE EARTH SCIENCE</div><h1>돌을 보는<br />새로운 <em>시선.</em></h1><p>암석을 돌려 보고, 가까이 들여다보고,<br />관찰한 생각을 나만의 보고서로 남겨보세요.</p><div className="landing-actions">
      {identity ? <button className="primary-button" onClick={onStart}>{identity.role === 'teacher' ? '교사 대시보드 열기' : '활동 시작'} <span>↗</span></button> : <button className="primary-button" disabled={busy} onClick={onStudent}>{demoMode ? '학생 화면 미리보기' : 'Google 계정으로 시작'} <span>↗</span></button>}
      {!identity && <button className="text-button" onClick={() => setTeacherOpen(!teacherOpen)}>교사 화면 {teacherOpen ? '닫기' : '열기'} <span>→</span></button>}
    </div>{teacherOpen && !identity && <form className="teacher-login" onSubmit={(e) => { e.preventDefault(); onTeacher(code); }}><label htmlFor="teacher-code">교사 접근 코드</label><div><input id="teacher-code" type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="접근 코드를 입력하세요" autoComplete="off" disabled={busy} /><button type="submit" disabled={busy || !code.trim()}>입장 →</button></div></form>}
    {error && <p className="notice error" role="alert">{error}</p>}{demoMode && <p className="demo-note">미리보기 모드 · 작성 내용은 이 브라우저에만 저장됩니다.</p>}</div>
    <div className="landing-art" aria-hidden="true"><div className="art-grid" /><div className="art-orbit orbit-a" /><div className="art-orbit orbit-b" /><div className="art-rock"><span /></div><div className="art-label top">SAMPLE / 01</div><div className="art-label bottom">OBSERVE · INFER · RECORD</div><div className="art-cross">✳</div></div>
    <div className="landing-footer"><span>01 / 관찰</span><span>02 / 추론</span><span>03 / 기록</span><span className="footer-long">암석 표면에서 시작하는 지구과학 탐구</span></div>
  </main>;
}

export default function App() {
  const [identity, setIdentity] = useState(null);
  const [screen, setScreen] = useState('home');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
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
  return <div className="app"><header className="site-header"><button className="header-logo" onClick={() => setScreen('home')}><Logo /></button><div className="header-mid">GEOLOGY / OBSERVATION STUDIO</div><div className="header-right">{identity && <><span className="header-user">{identity.role === 'teacher' ? '교사' : identity.user?.user_metadata?.full_name || identity.user?.email || '학생'}</span><button className="header-logout" onClick={logout}>로그아웃 ↗</button></>}</div></header>
    {screen === 'home' && <Landing identity={identity} busy={busy} error={error} onStudent={studentLogin} onTeacher={teacherLogin} onStart={() => start()} />}
    <Suspense fallback={<div className="loading-page">학습 공간을 준비하는 중입니다…</div>}>
      {screen === 'student' && data && <Student identity={identity} data={data} onRefresh={() => refresh()} onHome={() => setScreen('home')} />}
      {screen === 'teacher' && data && <Teacher data={data} onRefresh={() => refresh()} />}
    </Suspense>
  </div>;
}
