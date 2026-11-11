import React, { Suspense, lazy, useEffect, useState } from 'react';
import { currentIdentity, demoMode, googleSignIn, loadClassroom, loadStudentProfile, previewSignIn, saveStudentProfile, signOut, teacherSignIn } from './data.js';

const Student = lazy(() => import('./Student.jsx'));
const Teacher = lazy(() => import('./Teacher.jsx'));

function Logo() { return <span className="logo"><span className="logo-stone">◆</span> ROCK<span>LAB</span></span>; }

function SaveCloud({ state }) {
  const saving = state === '저장 중…';
  const failed = state === '저장 실패';
  const label = saving ? '저장 중…' : failed ? '저장 실패' : '저장 완료';
  return <span className={`header-save ${saving ? 'saving' : ''} ${failed ? 'failed' : ''}`} role="status" aria-live="polite">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 18.5h10.2a4.2 4.2 0 0 0 .5-8.37A6 6 0 0 0 6.1 9.3 4.6 4.6 0 0 0 7 18.5z" fill={saving ? '#efece6' : '#f6e9e2'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {saving ? <path className="save-cloud-spin" d="M14.6 13a2.6 2.6 0 1 1-.76-1.84m.56-3.26v1.6h-1.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /> : failed ? <path d="M12 10.5v3.5m0 2h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /> : <path d="m9.3 13.1 1.8 1.8 3.5-3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />}
    </svg><span>{label}</span>
  </span>;
}

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

function ProfileForm({ profile, user, onSave, onClose }) {
  const [fields, setFields] = useState({ student_number: profile?.student_number || '', department: profile?.department || '', display_name: profile?.display_name || user?.user_metadata?.full_name || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = (key, value) => setFields((old) => ({ ...old, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (Object.values(fields).some((value) => !value.trim())) { setError('학번, 학과, 이름을 모두 입력해 주세요.'); return; }
    setSaving(true); setError('');
    try { await onSave(fields); } catch (e) { setError(e.message || '학생 정보를 저장하지 못했습니다.'); }
    finally { setSaving(false); }
  };
  return <div className="profile-backdrop"><form className="profile-card" onSubmit={submit} aria-labelledby="profile-title"><span className="eyebrow">STUDENT PROFILE</span><h2 id="profile-title">학생 정보</h2><p>보고서를 확인할 수 있도록 학번, 학과, 이름을 입력해 주세요. 나중에 수정할 수 있습니다.</p><label>학번<input autoFocus required maxLength={30} value={fields.student_number} onChange={(e) => update('student_number', e.target.value)} autoComplete="off" /></label><label>학과<input required maxLength={80} value={fields.department} onChange={(e) => update('department', e.target.value)} autoComplete="organization-title" /></label><label>이름<input required maxLength={80} value={fields.display_name} onChange={(e) => update('display_name', e.target.value)} autoComplete="name" /></label>{error && <p className="notice error" role="alert">{error}</p>}<div className="profile-actions">{onClose && <button type="button" className="outline-button" onClick={onClose}>취소</button>}<button className="primary-button" disabled={saving} type="submit">{saving ? '저장 중…' : '저장하고 계속'} <span>→</span></button></div></form></div>;
}

export default function App() {
  const [identity, setIdentity] = useState(null);
  const [screen, setScreen] = useState('home');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [studentSaveState, setStudentSaveState] = useState('저장 완료');
  useEffect(() => { currentIdentity().then(setIdentity).catch((e) => setError(e.message || '로그인 상태를 확인하지 못했습니다.')).finally(() => setBusy(false)); }, []);
  useEffect(() => {
    if (identity?.role !== 'student') { setProfile(null); setProfileOpen(false); return; }
    let active = true;
    setProfileLoading(true);
    loadStudentProfile(identity.user.id).then((result) => {
      if (!active) return;
      setProfile(result);
      if (result && 'student_number' in result && (!result.student_number || !result.department || !result.display_name)) setProfileOpen(true);
    }).catch((e) => { if (active) setError(e.message || '학생 정보를 확인하지 못했습니다.'); }).finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [identity]);
  const refresh = async (who = identity) => { const next = await loadClassroom(who.role, who.user.id); setData(next); return next; };
  const start = async (who = identity) => {
    if (!who) return;
    if (who.role === 'student') {
      const currentProfile = profile || await loadStudentProfile(who.user.id);
      if (!profile) setProfile(currentProfile);
      if (currentProfile && 'student_number' in currentProfile && (!currentProfile.student_number || !currentProfile.department || !currentProfile.display_name)) { setProfileOpen(true); return; }
    }
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
  const profileRequired = !!profile && 'student_number' in profile && (!profile.student_number || !profile.department || !profile.display_name);
  const saveProfile = async (fields) => { const next = await saveStudentProfile(identity.user.id, fields); setProfile(next); setProfileOpen(false); if (data && screen === 'teacher') await refresh(); };
  return <div className={`app ${screen === 'student' ? 'student-active' : ''}`}><header className={`site-header ${screen === 'student' ? 'student-header' : ''}`}><div className="header-brand"><button className="header-logo" onClick={() => setScreen('home')}><Logo /></button>{screen === 'student' && <div className="header-activity"><strong>암석 관찰 활동</strong><span>시료를 자유롭게 오가며 관찰하세요.</span></div>}</div><div className="header-right">{identity ? <>{screen === 'student' && <><SaveCloud state={studentSaveState} /><span className="header-save-divider" aria-hidden="true" /></>}{identity.role === 'student' && profile && 'student_number' in profile ? <button className="header-user header-user-button" onClick={() => setProfileOpen(true)} title="학생 정보 수정">{profile?.display_name || identity.user?.user_metadata?.full_name || '학생'} 님</button> : <span className="header-user">{identity.role === 'teacher' ? '교사' : `${profile?.display_name || identity.user?.user_metadata?.full_name || '학생'} 님`}</span>}<button className="header-logout" onClick={logout}>로그아웃</button></> : screen === 'home' && <><button className="header-teacher" onClick={() => setTeacherOpen(!teacherOpen)}>교사 화면</button><button className="header-login" disabled={busy} onClick={studentLogin}>로그인</button></>}</div></header>
    {screen === 'home' && <Landing identity={identity} busy={busy} error={error} onStudent={studentLogin} onTeacher={teacherLogin} onStart={() => start()} teacherOpen={teacherOpen} />}
    <Suspense fallback={<div className="loading-page">학습 공간을 준비하는 중입니다…</div>}>
      {screen === 'student' && data && <Student identity={identity} data={data} onRefresh={() => refresh()} onHome={() => setScreen('home')} onSaveStateChange={setStudentSaveState} />}
      {screen === 'teacher' && data && <Teacher data={data} onRefresh={() => refresh()} />}
    </Suspense>
    {identity?.role === 'student' && profileOpen && profile && 'student_number' in profile && <ProfileForm key={identity.user.id} profile={profile} user={identity.user} onSave={saveProfile} onClose={profileRequired ? null : () => setProfileOpen(false)} />}
  </div>;
}
