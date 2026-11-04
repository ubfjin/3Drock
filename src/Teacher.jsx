import React, { useState } from 'react';
import { addModel, demoMode, saveModelOrder, saveQuestions } from './data.js';

export default function Teacher({ data, onRefresh }) {
  const [tab, setTab] = useState('reports');
  const [models, setModels] = useState(data.models);
  const [questions, setQuestions] = useState(data.questions);
  const [studentId, setStudentId] = useState(data.profiles[0]?.id || '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newCredit, setNewCredit] = useState('');
  const [newSource, setNewSource] = useState('');
  const [progress, setProgress] = useState(0);
  const active = models.filter((m) => m.active);
  const profile = data.profiles.find((p) => p.id === studentId);
  const studentResponses = data.responses.filter((r) => r.user_id === studentId);
  const submittedStudents = data.profiles.filter((p) => active.length && active.every((m) => data.responses.some((r) => r.user_id === p.id && r.model_id === m.id && r.submitted_at))).length;

  const perform = async (action, success) => {
    setBusy(true); setMessage('');
    try {
      await action();
      const refreshed = await onRefresh();
      setModels(refreshed.models);
      setQuestions(refreshed.questions);
      setMessage(success);
    } catch (error) { setMessage(error.message || '저장하지 못했습니다.'); }
    finally { setBusy(false); }
  };
  const move = (index, direction) => {
    const next = [...models], target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const ordered = next.map((m, i) => ({ ...m, order_index: i + 1 }));
    setModels(ordered);
    perform(() => saveModelOrder(ordered), '관찰 순서를 저장했습니다.');
  };
  const toggle = (index) => {
    const next = models.map((m, i) => i === index ? { ...m, active: !m.active } : m);
    setModels(next);
    perform(() => saveModelOrder(next), '시료 공개 상태를 저장했습니다.');
  };
  const upload = (event) => {
    event.preventDefault();
    perform(async () => {
      if (!file || !newTitle.trim()) throw new Error('GLB 파일과 교사용 모델 이름을 입력해 주세요.');
      await addModel({ file, title: newTitle.trim(), credit: newCredit.trim(), sourceUrl: newSource.trim(), onProgress: setProgress });
      setFile(null); setNewTitle(''); setNewCredit(''); setNewSource(''); setProgress(0);
    }, '새 시료를 등록했습니다.');
  };

  return <main className="teacher-page"><div className="teacher-intro"><div><span className="eyebrow">TEACHER WORKSPACE</span><h1>수업 대시보드<span>✳</span></h1><p>시료와 질문을 관리하고 학생들의 관찰 기록을 확인하세요.</p></div><div className="teacher-summary"><div><strong>{active.length}</strong><span>활동 시료</span></div><div><strong>{data.profiles.length}</strong><span>참여 학생</span></div><div><strong>{submittedStudents}</strong><span>제출 완료</span></div></div></div><div className="teacher-tabs" role="tablist"><button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>학생 보고서</button><button className={tab === 'models' ? 'active' : ''} onClick={() => setTab('models')}>시료 관리</button><button className={tab === 'questions' ? 'active' : ''} onClick={() => setTab('questions')}>공통 문항</button></div>{message && <p className="teacher-message" role="status">{message}</p>}
    {tab === 'reports' && <div className="teacher-content report-review"><div className="student-list"><div className="panel-title"><span>STUDENTS</span><strong>{data.profiles.length}명</strong></div>{data.profiles.length ? data.profiles.map((p) => { const count = active.filter((m) => data.responses.find((r) => r.user_id === p.id && r.model_id === m.id)?.submitted_at).length; return <button key={p.id} className={studentId === p.id ? 'active' : ''} onClick={() => setStudentId(p.id)}><span className="student-avatar">{(p.display_name || p.email || '학').slice(0, 1)}</span><span><strong>{p.display_name || p.email}</strong><small>{p.email}</small></span><em>{count}/{active.length}</em></button>; }) : <p className="empty-list">아직 참여한 학생이 없습니다.</p>}</div><div className="review-body">{profile ? <><div className="review-heading"><div><span className="eyebrow">REPORT REVIEW</span><h2>{profile.display_name || profile.email}의 관찰 보고서</h2><p>{profile.email}</p></div><button className="outline-button" onClick={onRefresh}>새로고침 ↻</button></div><div className="review-models">{models.map((model, index) => { const response = studentResponses.find((r) => r.model_id === model.id); return <article className="review-card" key={model.id}><div className="review-card-head"><div><span className="review-sample">시료 {String(index + 1).padStart(2, '0')}</span><h3>{model.private_title || '이름 미설정'}</h3></div><span className={`review-status ${response?.submitted_at ? 'done' : ''}`}>{response?.submitted_at ? `${response.submission_count}회 제출` : '미제출'}</span></div>{response?.submitted_at && <p className="review-date">최근 제출: {new Date(response.submitted_at).toLocaleString('ko-KR')}</p>}{data.questions.map((q) => <div className="review-answer" key={q.position}><span>Q{q.position}. {q.prompt}</span><p>{response?.submitted_answers?.[q.position] || '아직 제출한 답변이 없습니다.'}</p></div>)}</article>; })}</div></> : <div className="empty-review">학생을 선택하면 제출된 보고서가 여기에 표시됩니다.</div>}</div></div>}
    {tab === 'models' && <div className="teacher-content management"><div className="management-main"><div className="management-title"><div><span className="eyebrow">MODEL LIBRARY</span><h2>시료 순서와 공개 상태</h2></div><span>학생 화면에는 실제 이름이 표시되지 않습니다.</span></div><div className="model-list">{models.map((model, index) => <div className="model-row" key={model.id}><span className="model-order">{String(index + 1).padStart(2, '0')}</span><div><strong>{model.private_title || '이름 미설정'}</strong><small>학생 표시: 시료 {String(index + 1).padStart(2, '0')} · {model.active ? '활동에 포함' : '숨김'}</small></div><div className="model-row-actions"><button disabled={busy || index === 0} onClick={() => move(index, -1)} title="위로">↑</button><button disabled={busy || index === models.length - 1} onClick={() => move(index, 1)} title="아래로">↓</button><button className={model.active ? 'active' : ''} disabled={busy} onClick={() => toggle(index)}>{model.active ? '활성' : '숨김'}</button></div></div>)}</div></div><aside className="management-side"><span className="eyebrow">ADD NEW SAMPLE</span><h3>새 시료 등록</h3><p>등록 순서대로 학생에게 중립적인 시료 번호가 표시됩니다.</p>{demoMode ? <div className="demo-upload-note">모델 업로드는 Supabase 프로젝트 연결 후 활성화됩니다. 현재 두 예시 모델의 순서와 문항을 미리보기에서 조정할 수 있습니다.</div> : <form onSubmit={upload}><label>GLB 모델 파일<input type="file" accept=".glb" onChange={(e) => setFile(e.target.files[0] || null)} /></label><label>교사용 실제 이름<input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="학생에게 표시되지 않습니다" /></label><label>학생에게 보일 출처 표기<input value={newCredit} onChange={(e) => setNewCredit(e.target.value)} placeholder="제작자 · 라이선스" /></label><label>원본 자료 주소 (교사용)<input value={newSource} onChange={(e) => setNewSource(e.target.value)} placeholder="https://" /></label><button className="primary-button" disabled={busy || !file || !newTitle.trim()}>{busy ? `업로드 중 ${progress}%` : '시료 등록'} <span>↗</span></button></form>}</aside></div>}
    {tab === 'questions' && <div className="teacher-content question-management"><div><span className="eyebrow">SHARED QUESTION SET</span><h2>모든 시료에 적용할 3문항</h2><p>문항을 수정하면 이후 학생 활동 화면에 반영됩니다. 이미 제출된 답변은 그대로 남습니다.</p></div><div className="question-editors">{questions.map((q, index) => <label key={q.position}><span>QUESTION {String(q.position).padStart(2, '0')}</span><textarea rows={4} value={q.prompt} onChange={(e) => setQuestions((old) => old.map((item, i) => i === index ? { ...item, prompt: e.target.value } : item))} /></label>)}<button className="primary-button" disabled={busy || questions.some((q) => !q.prompt.trim())} onClick={() => perform(() => saveQuestions(questions), '공통 문항을 저장했습니다.')}>문항 저장 <span>↗</span></button></div></div>}
  </main>;
}
