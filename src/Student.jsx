import React, { useEffect, useMemo, useRef, useState } from 'react';
import Viewer from './Viewer.jsx';
import { demoMode, modelUrl, saveDraft, submitAll } from './data.js';

const blank = () => ({ 1: '', 2: '', 3: '' });
const filled = (value) => String(value || '').trim().length > 0;
const complete = (answers) => [1, 2, 3].every((n) => filled(answers?.[n]));

export default function Student({ identity, data, onRefresh, onHome, onSaveStateChange }) {
  const models = useMemo(() => data.models.filter((m) => m.active), [data.models]);
  const [selected, setSelected] = useState(0);
  const [drafts, setDrafts] = useState(() => Object.fromEntries(data.responses.map((r) => [r.model_id, { ...blank(), ...r.draft_answers }])));
  const [responses, setResponses] = useState(data.responses);
  const [saveState, setSaveState] = useState('저장됨');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const timers = useRef({});
  const pending = useRef({});
  const queues = useRef({});
  const draftsRef = useRef(drafts);
  const selectedModel = models[selected];
  const completedCount = models.filter((m) => complete(drafts[m.id])).length;
  const submittedAt = responses.map((r) => r.submitted_at).filter(Boolean).sort().at(-1);
  const submittedCount = Math.max(0, ...responses.map((r) => r.submission_count || 0));
  const changedSinceSubmit = models.some((m) => JSON.stringify({ ...blank(), ...drafts[m.id] }) !== JSON.stringify({ ...blank(), ...responses.find((r) => r.model_id === m.id)?.submitted_answers }));
  const closed = !!data.settings?.due_at && clock >= Date.parse(data.settings.due_at);
  const grades = data.grades || [];
  const gradedCount = grades.filter((g) => models.some((m) => m.id === g.model_id)).length;
  const totalScore = grades.filter((g) => models.some((m) => m.id === g.model_id)).reduce((sum, grade) => sum + grade.score, 0);

  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 15000); return () => clearInterval(timer); }, []);
  useEffect(() => { onSaveStateChange(saveState); }, [onSaveStateChange, saveState]);

  useEffect(() => () => {
    Object.values(timers.current).forEach(clearTimeout);
    Object.entries(pending.current).forEach(([id, answers]) => { saveDraft(identity.user.id, id, answers).catch(() => {}); });
  }, [identity.user.id]);

  const persist = async (modelId, answers) => {
    try {
      const queued = (queues.current[modelId] || Promise.resolve()).catch(() => {}).then(() => saveDraft(identity.user.id, modelId, answers));
      queues.current[modelId] = queued;
      const saved = await queued;
      setResponses((old) => [...old.filter((r) => r.model_id !== modelId), saved]);
      if (pending.current[modelId] === answers) delete pending.current[modelId];
      if (!Object.keys(pending.current).length) setSaveState('모든 변경사항 저장됨');
      setError('');
    } catch (e) { setSaveState('저장 실패'); setError(`자동 저장 실패: ${e.message || '다시 시도해 주세요.'}`); }
  };

  const updateAnswer = (position, value) => {
    if (!selectedModel || closed) return;
    const answers = { ...blank(), ...draftsRef.current[selectedModel.id], [position]: value };
    const next = { ...draftsRef.current, [selectedModel.id]: answers };
    draftsRef.current = next;
    setDrafts(next);
    pending.current[selectedModel.id] = answers;
    setSaveState('저장 중…');
    clearTimeout(timers.current[selectedModel.id]);
    timers.current[selectedModel.id] = setTimeout(() => persist(selectedModel.id, answers), 700);
  };

  const selectModel = (index) => {
    const id = selectedModel?.id;
    if (id && pending.current[id]) {
      clearTimeout(timers.current[id]);
      persist(id, pending.current[id]);
    }
    setSelected(index);
  };

  const finalSubmit = async () => {
    if (closed) { setError('과제 마감 시간이 지났습니다.'); return; }
    if (completedCount !== models.length) { setError('비어 있는 답변을 모두 작성한 뒤 제출할 수 있습니다.'); return; }
    setSubmitting(true); setError('');
    try {
      const entries = Object.entries(pending.current);
      entries.forEach(([id]) => clearTimeout(timers.current[id]));
      for (const [id, answers] of entries) await persist(id, answers);
      await Promise.all(Object.values(queues.current));
      if (Object.keys(pending.current).length) throw new Error('답변 저장에 실패했습니다. 다시 시도해 주세요.');
      await submitAll(identity.user.id);
      const refreshed = await onRefresh();
      setResponses(refreshed.responses);
      setSaveState('제출 완료');
    } catch (e) { setError(e.message || '제출하지 못했습니다.'); }
    finally { setSubmitting(false); }
  };

  if (!models.length) return <div className="empty-page"><h2>아직 관찰할 시료가 없습니다.</h2><p>교사가 모델을 등록하면 활동을 시작할 수 있습니다.</p><button onClick={onHome}>홈으로</button></div>;

  return <main className="student-page reference-workspace">
    <aside className="sample-rail" aria-label="시료 목록">
      <nav aria-label="암석 시료 목록">
        {models.map((model, index) => {
          const answers = drafts[model.id];
          const answered = [1, 2, 3].filter((n) => filled(answers?.[n])).length;
          const done = answered === 3;
          return <button key={model.id} className={`sample-link ${index === selected ? 'selected' : ''}`} onClick={() => selectModel(index)} title={`시료 ${String(index + 1).padStart(2, '0')} · ${answered}/3 문항 작성`}>
            <span className="sample-number">{String(index + 1).padStart(2, '0')}</span>
            <span className="sample-title">시료 {String(index + 1).padStart(2, '0')}</span>
            {done ? <span className="sample-done" aria-label="작성 완료">✓</span> : <span className="sample-dots" aria-label={`${answered}/3 문항 작성`}>{[1, 2, 3].map((n) => <i key={n} className={filled(answers?.[n]) ? 'filled' : ''} />)}</span>}
          </button>;
        })}
      </nav>
      <div className="rail-progress"><div><span>완료한 시료</span><strong>{completedCount}<small>/{models.length}</small></strong></div><div className="progress-track"><span style={{ width: `${completedCount / models.length * 100}%` }} /></div></div>
    </aside>

    <section className="student-view" aria-label="3D 암석 관찰">
      <Viewer key={selectedModel.id} url={modelUrl(selectedModel)} sampleNo={selected + 1} credit={selectedModel.credit_public} onPrevious={() => selectModel((selected - 1 + models.length) % models.length)} onNext={() => selectModel((selected + 1) % models.length)} />
    </section>

    <section className="report-panel" aria-label="관찰 보고서">
      <div className="report-scroll">
        <div className="report-head"><h2>시료 {String(selected + 1).padStart(2, '0')} 관찰 보고서</h2><p>{demoMode ? '답변은 이 브라우저에 자동 저장됩니다.' : '답변은 자동 저장됩니다. 저장 완료 표시를 확인한 뒤 나가면 같은 Google 계정으로 이어 쓸 수 있습니다.'} 최종 제출은 따로 눌러 주세요.</p></div>
        {data.settings?.due_at && <p className="deadline-banner">{closed ? '과제 마감 · 답변을 수정하거나 제출할 수 없습니다.' : `제출 마감: ${new Date(data.settings.due_at).toLocaleString('ko-KR')}`}</p>}
        {data.settings?.grades_released && <div className="grade-banner"><strong>채점 결과: {gradedCount}/{models.length}개 시료 채점 · {totalScore}점</strong>{grades.find((g) => g.model_id === selectedModel.id) && <p>현재 시료: {grades.find((g) => g.model_id === selectedModel.id).score}/{data.settings.max_score}점<br />{grades.find((g) => g.model_id === selectedModel.id).feedback}</p>}</div>}
        <div className="report-fields">
          {data.questions.map((question) => <label className="question" key={question.position} htmlFor={`answer-${question.position}`}>
            <span className="question-label"><span className={`question-badge ${filled(drafts[selectedModel.id]?.[question.position]) ? 'answered' : ''}`}>{question.position}</span><span>{question.prompt}</span></span>
            <textarea id={`answer-${question.position}`} value={drafts[selectedModel.id]?.[question.position] || ''} onChange={(e) => updateAnswer(question.position, e.target.value)} placeholder="관찰하고 생각한 내용을 자유롭게 작성해 주세요." rows={4} readOnly={closed} />
          </label>)}
        </div>
      </div>
      <div className="report-bottom">{error && <p className="notice error" role="alert">{error}</p>}<div className="submit-row">{submittedAt ? <span className="submitted-note">최근 제출: {new Date(submittedAt).toLocaleString('ko-KR')} · {submittedCount}회 제출<br />{closed ? '과제 접수가 마감되었습니다.' : '수정 후 다시 제출할 수 있습니다.'}</span> : <span>{closed ? '과제 접수 마감' : completedCount === models.length ? '모든 답변을 작성했습니다. 제출할 준비가 되었습니다.' : '모든 시료의 3문항을 작성하면 최종 제출할 수 있습니다.'}</span>}<button className="primary-button" disabled={closed || submitting || completedCount !== models.length || (!!submittedAt && !changedSinceSubmit)} onClick={finalSubmit}>{submitting ? '제출 중…' : submittedAt ? '다시 제출' : '최종 제출'}</button></div></div>
    </section>
  </main>;
}
