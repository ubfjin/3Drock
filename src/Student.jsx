import React, { useEffect, useMemo, useRef, useState } from 'react';
import Viewer from './Viewer.jsx';
import { modelUrl, saveDraft, submitAll } from './data.js';

const blank = () => ({ 1: '', 2: '', 3: '' });
const filled = (value) => String(value || '').trim().length > 0;
const complete = (answers) => [1, 2, 3].every((n) => filled(answers?.[n]));

export default function Student({ identity, data, onRefresh, onHome }) {
  const models = useMemo(() => data.models.filter((m) => m.active), [data.models]);
  const [selected, setSelected] = useState(0);
  const [drafts, setDrafts] = useState(() => Object.fromEntries(data.responses.map((r) => [r.model_id, { ...blank(), ...r.draft_answers }])));
  const [responses, setResponses] = useState(data.responses);
  const [saveState, setSaveState] = useState('저장됨');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const timers = useRef({});
  const pending = useRef({});
  const queues = useRef({});
  const draftsRef = useRef(drafts);
  const selectedModel = models[selected];
  const completedCount = models.filter((m) => complete(drafts[m.id])).length;
  const submittedAt = responses.map((r) => r.submitted_at).filter(Boolean).sort().at(-1);
  const submittedCount = Math.max(0, ...responses.map((r) => r.submission_count || 0));
  const changedSinceSubmit = models.some((m) => JSON.stringify({ ...blank(), ...drafts[m.id] }) !== JSON.stringify({ ...blank(), ...responses.find((r) => r.model_id === m.id)?.submitted_answers }));

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
    if (!selectedModel) return;
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
  return <main className="student-page">
    <aside className="sample-rail"><div className="rail-top"><span className="eyebrow">YOUR FIELD WORK</span><h2>암석 관찰</h2><p>시료를 자유롭게 오가며 관찰하세요.</p></div><div className="progress-meta"><span>진행 상황</span><strong>{completedCount} <small>/ {models.length}</small></strong></div><div className="progress-track"><span style={{ width: `${completedCount / models.length * 100}%` }} /></div><nav aria-label="암석 시료 목록">{models.map((model, index) => <button key={model.id} className={`sample-link ${index === selected ? 'selected' : ''}`} onClick={() => selectModel(index)}><span className="sample-number">{String(index + 1).padStart(2, '0')}</span><span><strong>시료 {String(index + 1).padStart(2, '0')}</strong><small>{complete(drafts[model.id]) ? '3문항 작성 완료' : `${[1, 2, 3].filter((n) => filled(drafts[model.id]?.[n])).length} / 3문항 작성`}</small></span><span className="sample-check">{complete(drafts[model.id]) ? '✓' : '→'}</span></button>)}</nav><div className="rail-bottom"><span>모든 시료의 3문항을 작성하면<br />최종 제출할 수 있습니다.</span></div></aside>
    <section className="student-view"><div className="section-topline"><span>시료 {String(selected + 1).padStart(2, '0')} / {String(models.length).padStart(2, '0')}</span><span>자유 관찰</span></div><Viewer key={selectedModel.id} url={modelUrl(selectedModel)} sampleNo={selected + 1} credit={selectedModel.credit_public} /><div className="view-under"><span className="view-under-mark">✳</span><p>모델을 회전하고 확대해 보세요.<br /><strong>표면의 작은 특징도 관찰의 단서가 됩니다.</strong></p></div></section>
    <section className="report-panel"><div className="report-head"><div><span className="eyebrow">OBSERVATION REPORT</span><h2>관찰 보고서 <span>/ {String(selected + 1).padStart(2, '0')}</span></h2></div><span className={`save-indicator ${saveState === '저장 실패' ? 'failed' : ''}`}><i />{saveState}</span></div><div className="report-fields">{data.questions.map((question) => <div className="question" key={question.position}><div className="question-label"><span>{String(question.position).padStart(2, '0')}</span><label htmlFor={`answer-${question.position}`}>{question.prompt}</label></div><textarea id={`answer-${question.position}`} value={drafts[selectedModel.id]?.[question.position] || ''} onChange={(e) => updateAnswer(question.position, e.target.value)} placeholder="관찰하고 생각한 내용을 자유롭게 작성해 주세요." rows={question.position === 1 ? 4 : 5} /><div className="question-status">{filled(drafts[selectedModel.id]?.[question.position]) ? '작성됨' : '작성 필요'}</div></div>)}</div><div className="report-bottom">{error && <p className="notice error" role="alert">{error}</p>}{submittedAt && <p className="submitted-note">최근 제출: {new Date(submittedAt).toLocaleString('ko-KR')} · {submittedCount}회 제출<br />수정 후 다시 제출할 수 있습니다.</p>}<div className="submit-row"><span>{completedCount === models.length ? '모든 시료 작성 완료' : `${models.length - completedCount}개 시료의 답변이 남았습니다.`}</span><button className="primary-button" disabled={submitting || completedCount !== models.length || (!!submittedAt && !changedSinceSubmit)} onClick={finalSubmit}>{submitting ? '제출 중…' : submittedAt ? '다시 제출' : '최종 제출'} <span>↗</span></button></div></div></section>
  </main>;
}
