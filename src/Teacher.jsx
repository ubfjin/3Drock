import React, { useState } from 'react';
import { saveClassSettings, saveGrade, saveModelOrder, saveOriginalModelUrl, saveQuestions } from './data.js';

const localDateTime = (value) => value ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)).replace(' ', 'T') : '';

function GradeEditor({ grade, input, max, busy, onChange, onSave }) {
  return <div className="grading-box"><label>시료 점수 <span>0~{max}점</span><input type="number" min="0" max={max} step="1" value={input.score ?? ''} onChange={(e) => onChange('score', e.target.value)} /></label><label>교사 피드백<textarea rows={3} value={input.feedback ?? ''} onChange={(e) => onChange('feedback', e.target.value)} placeholder="선택 사항" /></label><div><span>{grade ? '채점 저장됨' : '미채점'}</span><button className="outline-button" disabled={busy} onClick={onSave}>채점 저장</button></div></div>;
}

function SettingsPanel({ settings, setSettings, dueInput, setDueInput, busy, perform, setMessage }) {
  const save = () => {
    const max = Number(settings.max_score);
    if (!Number.isInteger(max) || max < 1 || max > 100) { setMessage('만점은 1~100 사이의 정수로 입력해 주세요.'); return; }
    perform(() => saveClassSettings({ due_at: dueInput ? new Date(`${dueInput}+09:00`).toISOString() : null, max_score: max }), '마감과 만점을 저장했습니다.');
  };
  return <div className="teacher-content settings-panel"><div><span className="eyebrow">CLASS SETTINGS</span><h2>마감과 채점 설정</h2><p>마감 전에는 수정·재제출할 수 있습니다. 마감 시각부터 저장과 제출이 잠깁니다.</p></div><div className="settings-form"><label>제출 마감 날짜와 시각 <small>한국 시간</small><input type="datetime-local" value={dueInput} onChange={(e) => setDueInput(e.target.value)} /></label><label>시료 하나의 만점<input type="number" min="1" max="100" step="1" value={settings.max_score} onChange={(e) => setSettings((old) => ({ ...old, max_score: e.target.value }))} /></label><button className="primary-button" disabled={busy} onClick={save}>설정 저장 <span>↗</span></button><div className="release-box"><strong>채점 결과 학생 공개</strong><p>공개 전에는 교사만 점수와 피드백을 볼 수 있습니다.</p><button className="outline-button" disabled={busy} onClick={() => perform(() => saveClassSettings({ grades_released: !settings.grades_released }), settings.grades_released ? '채점 결과를 다시 숨겼습니다.' : '채점 결과를 학생에게 공개했습니다.')}>{settings.grades_released ? '공개 중 · 다시 숨기기' : '채점 결과 공개하기'}</button></div></div></div>;
}

export default function Teacher({ data, onRefresh }) {
  const [tab, setTab] = useState('reports');
  const [models, setModels] = useState(data.models);
  const [originalInputs, setOriginalInputs] = useState(() => Object.fromEntries(data.models.map((model) => [model.id, model.original_asset_url || ''])));
  const [questions, setQuestions] = useState(data.questions);
  const [settings, setSettings] = useState(data.settings);
  const [dueInput, setDueInput] = useState(localDateTime(data.settings?.due_at));
  const [gradeInputs, setGradeInputs] = useState(() => Object.fromEntries((data.grades || []).map((g) => [`${g.user_id}:${g.model_id}`, { score: String(g.score), feedback: g.feedback }])));
  const [studentId, setStudentId] = useState(data.profiles[0]?.id || '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
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
      setSettings(refreshed.settings);
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
  const saveOriginal = (model) => {
    const url = (originalInputs[model.id] || '').trim();
    if (url) {
      try { if (new URL(url).protocol !== 'https:') throw new Error(); }
      catch { setMessage('원본 주소는 https://로 시작하는 공개 주소를 입력해 주세요.'); return; }
    }
    perform(() => saveOriginalModelUrl(model.id, url), url ? '원본 모델 주소를 저장했습니다.' : '원본 모델 주소를 지웠습니다.');
  };
  const changeGrade = (key, field, value) => setGradeInputs((old) => ({ ...old, [key]: { score: old[key]?.score ?? '', feedback: old[key]?.feedback ?? '', [field]: value } }));
  const saveOneGrade = (model) => {
    const key = `${studentId}:${model.id}`, entry = gradeInputs[key] || {};
    const score = Number(entry.score);
    if (entry.score === '' || !Number.isInteger(score) || score < 0 || score > settings.max_score) { setMessage(`0~${settings.max_score} 사이의 정수 점수를 입력해 주세요.`); return; }
    perform(() => saveGrade(studentId, model.id, score, entry.feedback || ''), '채점을 저장했습니다.');
  };

  return <main className="teacher-page"><div className="teacher-intro"><div><span className="eyebrow">TEACHER WORKSPACE</span><h1>수업 대시보드<span>✳</span></h1><p>시료와 질문을 관리하고 학생들의 관찰 기록을 확인하세요.</p></div><div className="teacher-summary"><div><strong>{active.length}</strong><span>활동 시료</span></div><div><strong>{data.profiles.length}</strong><span>참여 학생</span></div><div><strong>{submittedStudents}</strong><span>제출 완료</span></div></div></div><div className="teacher-tabs" role="tablist"><button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>학생 보고서</button><button className={tab === 'models' ? 'active' : ''} onClick={() => setTab('models')}>시료 관리</button><button className={tab === 'questions' ? 'active' : ''} onClick={() => setTab('questions')}>공통 문항</button><button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>마감·점수 공개</button></div>{message && <p className="teacher-message" role="status">{message}</p>}
    {tab === 'reports' && <div className="teacher-content report-review"><div className="student-list"><div className="panel-title"><span>STUDENTS</span><strong>{data.profiles.length}명</strong></div>{data.profiles.length ? data.profiles.map((p) => { const count = active.filter((m) => data.responses.find((r) => r.user_id === p.id && r.model_id === m.id)?.submitted_at).length; return <button key={p.id} className={studentId === p.id ? 'active' : ''} onClick={() => setStudentId(p.id)}><span className="student-avatar">{(p.display_name || p.email || '학').slice(0, 1)}</span><span><strong>{p.display_name || p.email}</strong><small>{[p.department, p.student_number].filter(Boolean).join(' · ') || p.email}</small></span><em>{count}/{active.length}</em></button>; }) : <p className="empty-list">아직 참여한 학생이 없습니다.</p>}</div><div className="review-body">{profile ? <><div className="review-heading"><div><span className="eyebrow">REPORT REVIEW</span><h2>{profile.display_name || profile.email}의 관찰 보고서</h2><p>{[profile.department, profile.student_number, profile.email].filter(Boolean).join(' · ')}</p></div><button className="outline-button" onClick={onRefresh}>새로고침 ↻</button></div><div className="review-models">{models.map((model, index) => { const response = studentResponses.find((r) => r.model_id === model.id); return <article className="review-card" key={model.id}><div className="review-card-head"><div><span className="review-sample">시료 {String(index + 1).padStart(2, '0')}</span><h3>{model.private_title || '이름 미설정'}</h3></div><span className={`review-status ${response?.submitted_at ? 'done' : ''}`}>{response?.submitted_at ? `${response.submission_count}회 제출` : '미제출'}</span></div>{response?.submitted_at && <p className="review-date">최근 제출: {new Date(response.submitted_at).toLocaleString('ko-KR')}</p>}{data.questions.map((q) => <div className="review-answer" key={q.position}><span>Q{q.position}. {q.prompt}</span><p>{response?.submitted_answers?.[q.position] || '아직 제출한 답변이 없습니다.'}</p></div>)}{response?.submitted_at && <GradeEditor grade={data.grades?.find((g) => g.user_id === studentId && g.model_id === model.id)} input={gradeInputs[`${studentId}:${model.id}`] || { score: '', feedback: '' }} max={settings.max_score} busy={busy} onChange={(field, value) => changeGrade(`${studentId}:${model.id}`, field, value)} onSave={() => saveOneGrade(model)} />}</article>; })}</div></> : <div className="empty-review">학생을 선택하면 제출된 보고서가 여기에 표시됩니다.</div>}</div></div>}
    {tab === 'settings' && <SettingsPanel settings={settings} setSettings={setSettings} dueInput={dueInput} setDueInput={setDueInput} busy={busy} perform={perform} setMessage={setMessage} />}
    {tab === 'models' && <div className="teacher-content management"><div className="management-main"><div className="management-title"><div><span className="eyebrow">MODEL LIBRARY</span><h2>시료 순서와 공개 상태</h2></div><span>학생 화면에는 실제 이름이 표시되지 않습니다.</span></div><div className="model-list">{models.map((model, index) => <div className="model-row" key={model.id}><span className="model-order">{String(index + 1).padStart(2, '0')}</span><div><strong>{model.private_title || '이름 미설정'}</strong><small>학생 표시: 시료 {String(index + 1).padStart(2, '0')} · {model.active ? '활동에 포함' : '숨김'}</small><label className="original-url-label">R2 원본 주소<input type="url" value={originalInputs[model.id] || ''} onChange={(e) => setOriginalInputs((old) => ({ ...old, [model.id]: e.target.value }))} placeholder="https://models.example.com/sample-01-original.glb" aria-label={`${model.private_title || `시료 ${index + 1}`} R2 원본 주소`} /></label></div><div className="model-row-actions"><button disabled={busy || index === 0} onClick={() => move(index, -1)} title="위로">↑</button><button disabled={busy || index === models.length - 1} onClick={() => move(index, 1)} title="아래로">↓</button><button className={model.active ? 'active' : ''} disabled={busy} onClick={() => toggle(index)}>{model.active ? '활성' : '숨김'}</button><button disabled={busy || (originalInputs[model.id] || '').trim() === (model.original_asset_url || '')} onClick={() => saveOriginal(model)}>주소 저장</button></div></div>)}</div></div><aside className="management-side"><span className="eyebrow">MODEL FILES</span><h3>시료 파일 등록</h3><p>가벼운 관찰용 모델은 사이트에서 즉시 보여줍니다. 각 시료의 R2 원본 주소를 등록하면 학생이 그 시료를 선택했을 때 원본만 이어 불러옵니다.</p><div className="demo-upload-note">원본 주소를 등록하기 전에 Supabase SQL Editor에서 r2-originals.sql을 실행해 주세요. R2 파일은 브라우저에서 열 수 있는 공개 주소여야 합니다.</div></aside></div>}
    {tab === 'questions' && <div className="teacher-content question-management"><div><span className="eyebrow">SHARED QUESTION SET</span><h2>모든 시료에 적용할 3문항</h2><p>문항을 수정하면 이후 학생 활동 화면에 반영됩니다. 이미 제출된 답변은 그대로 남습니다.</p></div><div className="question-editors">{questions.map((q, index) => <label key={q.position}><span>QUESTION {String(q.position).padStart(2, '0')}</span><textarea rows={4} value={q.prompt} onChange={(e) => setQuestions((old) => old.map((item, i) => i === index ? { ...item, prompt: e.target.value } : item))} /></label>)}<button className="primary-button" disabled={busy || questions.some((q) => !q.prompt.trim())} onClick={() => perform(() => saveQuestions(questions), '공통 문항을 저장했습니다.')}>문항 저장 <span>↗</span></button></div></div>}
  </main>;
}


