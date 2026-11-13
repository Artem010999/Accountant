import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusPill, type PillTone } from '../../shared/ui';
import { ConsultantWidget } from '../consultant/ConsultantWidget';
import './Passport.css';

// Экран «Паспорт проекта» по design/project/Passport.dc.html. Логика — порт скрипта эталона (renderVals):
// блоки 1–10, подсветка утверждений по типу, панель утверждения, режим эксперта, правка поля, согласование.
// Сохранение и пересчёт спанов — за бэкендом (user-flows F9 п.5); здесь состояние экрана, как в эталоне.

type ClaimType = 'fact' | 'plan' | 'hyp' | 'client';
// Вид утверждения после проверки: «факт» различается по наличию документа.
type VisKind = 'ok' | 'nodoc' | 'plan' | 'hyp' | 'client';
type FieldStatus = 'ai' | 'needs' | 'reviewed' | 'approved';
type SectionDot = 'lock' | 'needs' | 'approved' | 'ai';
type Seg = string | { c: string };

interface ClaimDef {
  text: string;
  type: ClaimType;
  source: string | null;
  page: number | null;
  quote: string | null;
  conf: number;
  origin: string | null;
}

interface FieldDef {
  key: string;
  label: string;
  status: FieldStatus;
  segs: Seg[];
  editedSegs?: Seg[];
  editText?: string;
  note?: string;
}

interface SectionDef {
  id: number;
  short: string;
  name: string;
  founder?: boolean;
  fields: FieldDef[];
}

interface PassportState {
  sec: number;
  sel: string | null;
  expert: boolean;
  types: Record<string, ClaimType>;
  editing: string | null;
  edited: Record<string, boolean>;
  approved: Record<string, boolean>;
  dropped: boolean;
}

const SOURCE_FILE = 'Monetrix_presentation_02.11.pdf';

// Утверждения из эталона (порядок и значения — как в скрипте Passport.dc.html).
function fromDoc(text: string, type: ClaimType, page: number, quote: string, conf: number): ClaimDef {
  return { text, type, source: SOURCE_FILE, page, quote, conf, origin: null };
}

function fromWords(text: string, type: ClaimType, conf: number, origin: string | null): ClaimDef {
  return { text, type, source: null, page: null, quote: null, conf, origin };
}

const CLAIMS: Record<string, ClaimDef> = {
  team1: fromWords('Иванов И. И. — руководитель проекта и продуктовая аналитика', 'client', 0.88, 'Ответ на вопрос 8 ноября'),
  team2: fromWords('Разработчика планируем привлечь на первом этапе гранта', 'plan', 0.93, 'Ответ на вопрос 8 ноября'),
  comp1: fromWords('Опыт продуктовой аналитики в финтехе — 2 года', 'client', 0.81, 'Стартовый бриф'),
  prob1: fromDoc('Частному пользователю приходится учитывать средства и обязательства в нескольких сервисах', 'hyp', 3, 'учёт средств и обязательств разбросан по разным сервисам', 0.74),
  prob2: fromDoc('Руководителю небольшой компании требуется сопоставлять поступления, платежи и стоимость финансирования', 'hyp', 3, 'малому бизнесу сложно сопоставлять поступления и платежи', 0.71),
  ta1: fromDoc('Частные пользователи (B2C) и небольшие компании (B2B)', 'fact', 3, 'Целевые сегменты: B2C — частные лица, B2B — малые компании', 0.9),
  prod1: fromDoc('Monetrix — сервис единого финансового профиля и подготовки финансовых сценариев', 'fact', 1, 'Monetrix — единый финансовый профиль и сценарии', 0.92),
  feat1: fromDoc('MVP включает финансовый профиль, ручной ввод, маркетплейс, наработки API, ИИ-агентов и голосового помощника', 'fact', 4, 'MVP: финансовый профиль, ручной ввод, маркетплейс, API, ИИ-агенты, голосовой помощник', 0.95),
  feat2: fromDoc('Импорт выписок, сценарные расчёты и кабинет специалиста относятся к дальнейшему развитию', 'plan', 5, 'Roadmap: импорт выписок, сценарии, кабинет специалиста', 0.9),
  tech1: fromWords('Извлечение и нормализация данных из разнородных источников с контролем происхождения показателей', 'plan', 0.77, 'Стартовый бриф'),
  stage1: fromWords('В MVP версии 0.3 работают финансовый профиль и ручной ввод операций', 'client', 0.86, 'Ответ на вопрос 8 ноября'),
  back1: fromDoc('API-наработки для ФИНАМ и Т-Инвестиций', 'fact', 4, 'API: ФИНАМ, Т-Инвестиции', 0.89),
  res1: fromDoc('100 эталонных сценариев и 95% корректно распознанных ключевых полей', 'plan', 13, 'цель: 100 сценариев, 95% распознанных полей', 0.92),
  an1: fromWords('Аналог — приложения учёта расходов с ручным вводом', 'client', 0.7, 'Ответ на вопрос 8 ноября'),
  nov1: fromWords('Профиль с контролем происхождения каждого показателя снижает число ошибок в сценарных расчётах', 'hyp', 0.68, 'Стартовый бриф'),
  bm1: fromDoc('B2C — 349 ₽ в месяц, B2B — 3 490 ₽ в месяц', 'plan', 8, 'B2C 349 ₽/мес, B2B 3 490 ₽/мес', 0.94),
  tr1: fromDoc('выручку 10 000 рублей', 'fact', 10, 'Выручка: 10 000 ₽', 0.92),
  tr2: fromWords('две фокус-группы по 25 участников', 'fact', 0.84, 'Комментарий к материалам'),
  tr3: fromDoc('В 2027 году планируются три платных пилота по 250 000 рублей', 'plan', 13, '3 пилота × 250 000 ₽ в 2027', 0.96),
  le1: fromWords('Юридическое лицо пока не зарегистрировано', 'client', 0.9, 'Ответ на вопрос 8 ноября'),
  le2: fromWords('ООО будет создано после победы в конкурсе', 'plan', 0.93, 'Ответ на вопрос 8 ноября'),
  rid1: fromDoc('Свидетельство на программу «Монетрикс» № 2026618524 от 25.03.2026', 'fact', 15, 'Свидетельство № 2026618524 от 25.03.2026', 0.97),
  ip1: fromWords('Правообладатель свидетельства № 2026618524 — Иванов И. И., он же заявитель', 'client', 0.85, 'Ответ на вопрос 8 ноября'),
  ip2: fromWords('Права будут переданы ООО после его регистрации', 'plan', 0.9, 'Ответ на вопрос 8 ноября'),
  sk1: fromWords('С 05.11.2026 проект — участник Сколково: заявка № 226086, ОРН 1129477', 'client', 0.83, 'Сообщение от 05.11 с текстом уведомления'),
  gr1: fromDoc('Получен грант ФСИ 1 млн рублей', 'fact', 10, 'Грант ФСИ — 1 млн ₽', 0.88),
};

const ref = (c: string): Seg => ({ c });

const SECTIONS: SectionDef[] = [
  { id: 1, short: 'Основатель', name: 'Основатель, контакты, статус обучения', founder: true, fields: [] },
  {
    id: 2, short: 'Команда', name: 'Команда, роли, компетенции и опыт',
    fields: [
      { key: 'team_members', label: 'Состав команды', status: 'ai', segs: [ref('team1'), '. ', ref('team2'), '.'] },
      { key: 'competencies', label: 'Компетенции и опыт', status: 'ai', segs: [ref('comp1'), '.'] },
    ],
  },
  {
    id: 3, short: 'Проблема', name: 'Проблема и целевые пользователи',
    fields: [
      { key: 'problem', label: 'Проблема', status: 'ai', segs: [ref('prob1'), '. ', ref('prob2'), '.'] },
      { key: 'audience', label: 'Целевая аудитория', status: 'reviewed', segs: [ref('ta1'), '.'] },
    ],
  },
  {
    id: 4, short: 'Продукт', name: 'Продукт, функции и технология',
    fields: [
      { key: 'summary', label: 'Кратко о продукте', status: 'reviewed', segs: [ref('prod1'), ' для частных пользователей и компаний.'] },
      { key: 'features', label: 'Ключевые функции', status: 'ai', segs: [ref('feat1'), '. ', ref('feat2'), '.'] },
      { key: 'tech', label: 'Технологический подход', status: 'ai', segs: [ref('tech1'), '.'] },
    ],
  },
  {
    id: 5, short: 'Стадия', name: 'Стадия разработки и задел',
    fields: [
      { key: 'stage', label: 'Текущая стадия', status: 'ai', segs: [ref('stage1'), '.'] },
      { key: 'backlog', label: 'Существующий задел', status: 'reviewed', segs: ['Указаны ', ref('back1'), '.'] },
      { key: 'result', label: 'Результат первого этапа', status: 'ai', segs: ['Целевые показатели: ', ref('res1'), '.'] },
    ],
  },
  {
    id: 6, short: 'Аналоги', name: 'Аналоги и предполагаемые отличия',
    fields: [
      {
        key: 'analogues', label: 'Сравнение с аналогами', status: 'needs', segs: [ref('an1'), '.'],
        note: 'Нужен второй аналог и измеримое отличие — проверка новизны пропущена после двух попыток.',
      },
      { key: 'novelty', label: 'Гипотеза отличия', status: 'ai', segs: [ref('nov1'), '.'] },
    ],
  },
  {
    id: 7, short: 'Рынок', name: 'Рынок, бизнес-модель, продажи и пилоты',
    fields: [
      { key: 'bm', label: 'Бизнес-модель и цены', status: 'ai', segs: ['Плановые цены подписки: ', ref('bm1'), '.'] },
      {
        key: 'traction', label: 'Продажи и пилоты', status: 'ai',
        segs: ['Команда получила ', ref('tr1'), ' и провела ', ref('tr2'), '. ', ref('tr3'), '.'],
        editedSegs: ['Команда получила ', ref('tr1'), ' и провела две фокус-группы. ', ref('tr3'), '.'],
        editText: 'Команда получила выручку 10 000 рублей и провела две фокус-группы. В 2027 году планируются три платных пилота по 250 000 рублей.',
        note: 'Плановые продажи хранятся как план и не попадут в достижения.',
      },
    ],
  },
  {
    id: 8, short: 'Юрлица', name: 'Юридические лица и их роли',
    fields: [{ key: 'entity', label: 'Юридическое лицо', status: 'ai', segs: [ref('le1'), '. ', ref('le2'), '.'] }],
  },
  {
    id: 9, short: 'Права и РИД', name: 'Авторы, правообладатели и РИД',
    fields: [
      { key: 'rid', label: 'Документы на РИД', status: 'approved', segs: [ref('rid1'), '.'] },
      { key: 'ip', label: 'Правообладатель', status: 'ai', segs: [ref('ip1'), '. ', ref('ip2'), '.'] },
    ],
  },
  {
    id: 10, short: 'Поддержка', name: 'Полученная поддержка и обязательства',
    fields: [
      {
        key: 'grants', label: 'Гранты и статусы', status: 'ai', segs: [ref('gr1'), '. ', ref('sk1'), '.'],
        note: 'Статус Сколково обновлён по сообщению от 05.11 — в презентации от 02.11 указана только заявка. Оба источника сохранены.',
      },
    ],
  },
];

const FOUNDER_ROWS: [string, string][] = [
  ['ФИО', 'Иванов Иван Иванович'],
  ['Статус обучения', 'Студент · справка не загружена'],
  ['Вуз', '[Название вуза]'],
  ['Регион', '[Регион]'],
  ['Контакты', 'ivan@university.ru'],
];

const LEGEND: { kind: string; label: string }[] = [
  { kind: 'fact-doc', label: 'Факт с документом' },
  { kind: 'fact-nodoc', label: 'Факт без документа' },
  { kind: 'plan', label: 'План' },
  { kind: 'hyp', label: 'Гипотеза' },
  { kind: 'hearsay', label: 'Со слов команды' },
];

const KIND_LABEL: Record<VisKind, string> = {
  ok: 'Факт с документом',
  nodoc: 'Факт без документа',
  plan: 'План',
  hyp: 'Гипотеза',
  client: 'Со слов команды',
};

const KIND_CLASS: Record<VisKind, string> = {
  ok: 'passport-claim--fact-doc',
  nodoc: 'passport-claim--fact-nodoc',
  plan: 'passport-claim--plan',
  hyp: 'passport-claim--hyp',
  client: 'passport-claim--hearsay',
};

// Факты без документа и «со слов» — риски: в режиме эксперта остаются видимыми.
const RISKY: Record<VisKind, boolean> = { ok: false, nodoc: true, plan: false, hyp: false, client: true };

const ADVICE: Record<VisKind, string> = {
  nodoc: 'Эксперт фонда попросит подтверждение: протокол, акт, выписку или материалы исследования.',
  client: 'Сохранено как слова команды. Если есть документ — привяжите его.',
  plan: 'План не считается достижением.',
  hyp: 'Гипотезу стоит подтвердить исследованием.',
  ok: '',
};

const TYPE_OPTIONS: [ClaimType, string][] = [
  ['fact', 'Факт'],
  ['plan', 'План'],
  ['hyp', 'Гипотеза'],
  ['client', 'Со слов'],
];

const FIELD_CHIP: Partial<Record<FieldStatus, { label: string; tone: PillTone }>> = {
  needs: { label: 'Нужна проверка', tone: 'warning' },
  reviewed: { label: 'Подтверждено', tone: 'info' },
  approved: { label: 'Согласовано', tone: 'success' },
};

const INITIAL_STATE: PassportState = {
  sec: 7,
  sel: 'tr2',
  expert: false,
  types: {},
  editing: null,
  edited: {},
  approved: {},
  dropped: false,
};

function visKind(id: string, types: Record<string, ClaimType>): VisKind {
  const claim = CLAIMS[id];
  const type = types[id] ?? claim.type;
  if (type === 'fact') return claim.source ? 'ok' : 'nodoc';
  return type;
}

function fieldStatus(f: FieldDef, st: PassportState): FieldStatus {
  if (st.approved[f.key]) return 'approved';
  if (f.key === 'traction' && st.edited.traction && !st.dropped) return 'needs';
  if (st.edited[f.key] && f.status === 'approved') return 'ai';
  return f.status;
}

function sectionDot(s: SectionDef, st: PassportState): SectionDot {
  if (s.founder) return 'lock';
  const statuses = s.fields.map((f) => fieldStatus(f, st));
  if (statuses.includes('needs')) return 'needs';
  if (statuses.every((x) => x === 'approved')) return 'approved';
  return 'ai';
}

function segText(seg: Seg): string {
  return typeof seg === 'string' ? seg : CLAIMS[seg.c].text;
}

export function Passport() {
  const [st, setSt] = useState<PassportState>(INITIAL_STATE);
  const sec = SECTIONS.find((s) => s.id === st.sec) ?? SECTIONS[0];
  const selected = st.sel ? CLAIMS[st.sel] : undefined;
  const selectedKind = st.sel && selected ? visKind(st.sel, st.types) : null;

  const pickSection = (id: number) => setSt((p) => ({ ...p, sec: id, editing: null }));
  const pickClaim = (id: string) => setSt((p) => ({ ...p, sel: id }));
  const pickType = (type: ClaimType) =>
    setSt((p) => (p.sel ? { ...p, types: { ...p.types, [p.sel]: type } } : p));
  const toggleExpert = () => setSt((p) => ({ ...p, expert: !p.expert }));
  const startEdit = (key: string) => setSt((p) => ({ ...p, editing: key }));
  const cancelEdit = () => setSt((p) => ({ ...p, editing: null }));
  const saveEdit = (key: string) =>
    setSt((p) => {
      const approved = { ...p.approved };
      delete approved[key];
      const traction = key === 'traction';
      return {
        ...p,
        editing: null,
        edited: { ...p.edited, [key]: true },
        approved,
        dropped: traction ? false : p.dropped,
        sel: traction ? null : p.sel,
      };
    });
  const approveField = (key: string) => setSt((p) => ({ ...p, approved: { ...p.approved, [key]: true } }));
  const dropOrphan = () => setSt((p) => ({ ...p, dropped: true }));
  const undoOrphan = () =>
    setSt((p) => {
      const edited = { ...p.edited };
      delete edited.traction;
      return { ...p, edited, dropped: false };
    });

  return (
    <div className="passport">
      <div className="passport__head">
        <div className="passport__title">
          <h1 className="passport__h1">Паспорт проекта</h1>
          <StatusPill tone="warning" size="md">На проверке</StatusPill>
          <span className="passport__saved">Сохранено 2 минуты назад</span>
        </div>
        <div className="passport__actions">
          <button type="button" className="passport__btn">DOCX</button>
          <button type="button" className="passport__btn">PDF</button>
          <Link to="/result" className="passport__btn-brand">Итог проверки</Link>
        </div>
      </div>

      <div className="passport__bar">
        <ul aria-label="Обозначения" className="passport__legend">
          {LEGEND.map((item) => (
            <li key={item.kind}>
              <span className={`passport__swatch passport__swatch--${item.kind}`} aria-hidden="true" />
              {item.label}
            </li>
          ))}
        </ul>
        <button type="button" aria-pressed={st.expert} onClick={toggleExpert} className="passport__expert">
          Глазами эксперта
          <span className={`passport__switch${st.expert ? ' passport__switch--on' : ''}`} aria-hidden="true">
            <span className="passport__knob" />
          </span>
        </button>
      </div>

      <div className="passport__body">
        <nav aria-label="Блоки паспорта" className="passport__nav">
          {SECTIONS.map((s) => {
            const current = s.id === st.sec;
            return (
              <button
                key={s.id}
                type="button"
                aria-current={current ? 'true' : 'false'}
                onClick={() => pickSection(s.id)}
                className={`passport__nav-item${current ? ' passport__nav-item--current' : ''}`}
              >
                <span className="passport__nav-num">{s.id}</span>
                <span className="passport__nav-label">{s.short}</span>
                <span className={`passport__nav-dot passport__nav-dot--${sectionDot(s, st)}`} />
              </button>
            );
          })}
        </nav>

        <section className="passport__section">
          <div className="passport__sec-head">
            <span className="passport__eyebrow">Блок {sec.id}</span>
            <h2 className="passport__sec-title">{sec.name}</h2>
          </div>

          {sec.founder && (
            <div className="passport__founder">
              <dl className="passport__dl">
                {FOUNDER_ROWS.map(([term, value]) => (
                  <Fragment key={term}>
                    <dt>{term}</dt>
                    <dd>{value}</dd>
                  </Fragment>
                ))}
              </dl>
              <Link to="/profile" className="passport__founder-link">Изменить в профиле</Link>
            </div>
          )}

          {sec.fields.map((f) => {
            const fs = fieldStatus(f, st);
            const isEditing = st.editing === f.key;
            const useEdited = f.key === 'traction' && st.edited.traction === true;
            const segs = useEdited && f.editedSegs ? f.editedSegs : f.segs;
            const chip = FIELD_CHIP[fs];
            const canApprove = fs !== 'approved' && fs !== 'needs';
            const hasOrphan = useEdited && !st.dropped && !isEditing;
            const editText = f.editText ?? segs.map(segText).join('');
            return (
              <article key={f.key} className="passport__field">
                <div className="passport__field-head">
                  <div className="passport__field-title">
                    <h3 className="passport__field-name">{f.label}</h3>
                    {chip && <StatusPill tone={chip.tone}>{chip.label}</StatusPill>}
                  </div>
                  {!isEditing && (
                    <div className="passport__field-actions">
                      <button type="button" className="passport__btn-edit" onClick={() => startEdit(f.key)}>
                        Править
                      </button>
                      {canApprove && (
                        <button type="button" className="passport__btn-approve" onClick={() => approveField(f.key)}>
                          Согласовать
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <p className="passport__text">
                    {segs.map((seg, i) => {
                      if (typeof seg === 'string') return seg;
                      const v = visKind(seg.c, st.types);
                      const muted = st.expert && !RISKY[v];
                      const risk = st.expert && RISKY[v];
                      const classes = [
                        'passport-claim',
                        KIND_CLASS[v],
                        muted ? 'passport-claim--muted' : '',
                        risk ? 'passport-claim--risk' : '',
                        st.sel === seg.c ? 'passport-claim--selected' : '',
                      ].filter(Boolean).join(' ');
                      return (
                        <a
                          key={i}
                          href="#claim-panel"
                          className={classes}
                          data-kind={v}
                          onClick={() => pickClaim(seg.c)}
                        >
                          {CLAIMS[seg.c].text}
                        </a>
                      );
                    })}
                  </p>
                )}

                {isEditing && (
                  <FieldEditor
                    key={f.key}
                    inputId={`edit-${f.key}`}
                    initialText={editText}
                    wasApproved={fs === 'approved'}
                    onSave={() => saveEdit(f.key)}
                    onCancel={cancelEdit}
                  />
                )}

                {hasOrphan && (
                  <div role="alert" className="passport__orphan">
                    <span className="passport__orphan-title">1 утверждение потеряло привязку к тексту</span>
                    <span className="passport__orphan-text">две фокус-группы по 25 участников</span>
                    <div className="passport__orphan-actions">
                      <button type="button" className="passport__btn-drop" onClick={dropOrphan}>
                        Удалить утверждение
                      </button>
                      <button type="button" className="passport__btn-undo" onClick={undoOrphan}>
                        Вернуть прежний текст
                      </button>
                    </div>
                  </div>
                )}

                {f.note && !isEditing && <p className="passport__note">{f.note}</p>}
              </article>
            );
          })}
        </section>

        <aside id="claim-panel" aria-label="Утверждение" className="passport__panel">
          {!selected && (
            <p className="passport__panel-hint">
              Нажмите на выделенный фрагмент текста — здесь появятся тип, источник и действия.
            </p>
          )}
          {selected && st.sel && selectedKind && (
            <ClaimPanel
              text={selected.text}
              kind={selectedKind}
              type={st.types[st.sel] ?? selected.type}
              source={selected.source}
              page={selected.page}
              quote={selected.quote}
              origin={selected.origin ?? 'Слова пользователя'}
              conf={selected.conf}
              onPickType={pickType}
            />
          )}
        </aside>
      </div>
      <ConsultantWidget activeSectionId={st.sec} />
    </div>
  );
}

interface ClaimPanelProps {
  text: string;
  kind: VisKind;
  type: ClaimType;
  source: string | null;
  page: number | null;
  quote: string | null;
  origin: string;
  conf: number;
  onPickType: (type: ClaimType) => void;
}

function ClaimPanel({ text, kind, type, source, page, quote, origin, conf, onPickType }: ClaimPanelProps) {
  return (
    <div className="passport__claim">
      <span className={`passport__kind passport__kind--${kind}`}>{KIND_LABEL[kind]}</span>
      {/* Строки собраны в один текстовый узел, как в эталоне: иначе «» шейпятся отдельно. */}
      <p className="passport__claim-text">{`«${text}»`}</p>

      <div className="passport__block">
        <span className="passport__caption">Тип сведений</span>
        <div role="group" aria-label="Тип сведений" className="passport__types">
          {TYPE_OPTIONS.map(([id, label]) => {
            const pressed = type === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={pressed}
                onClick={() => onPickType(id)}
                className={`passport__type ${pressed ? 'passport__type--on' : 'passport__type--off'}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="passport__block">
        <span className="passport__caption">Источник</span>
        {source && (
          <div className="passport__source">
            <span className="passport__source-name">
              <svg className="passport__source-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                <path d="M14 3v5h5" />
              </svg>
              {source}
            </span>
            <span className="passport__source-page">{`Страница ${page ?? ''}`}</span>
            <span className="passport__source-quote">{`«${quote ?? ''}»`}</span>
          </div>
        )}
        {!source && (
          <div className="passport__source passport__source--plain">
            <span className="passport__origin">{origin}</span>
            <span className="passport__advice">{`Документа нет. ${ADVICE[kind]}`}</span>
          </div>
        )}
      </div>

      <span className="passport__conf">{`Уверенность ИИ в типе: ${Math.round(conf * 100)}%`}</span>

      <div className="passport__claim-actions">
        <button type="button" className="passport__btn-main">Привязать документ</button>
        <button type="button" className="passport__btn-second">Убрать из паспорта</button>
      </div>
    </div>
  );
}

interface FieldEditorProps {
  inputId: string;
  initialText: string;
  wasApproved: boolean;
  onSave: () => void;
  onCancel: () => void;
}

// Правка поля. Текст в черновике показан как в эталоне; сохранение помечает поле правленым (как в эталоне).
function FieldEditor({ inputId, initialText, wasApproved, onSave, onCancel }: FieldEditorProps) {
  const [draft, setDraft] = useState(initialText);
  return (
    <div className="passport__editor">
      <label htmlFor={inputId} className="passport__editor-hint">
        Правка текста поля. После сохранения Буха заново найдёт каждое утверждение в тексте.
      </label>
      <textarea
        id={inputId}
        rows={4}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="passport__textarea"
      />
      {wasApproved && <span className="passport__editor-warn">Поле согласовано. Правка снимет согласование.</span>}
      <div className="passport__editor-actions">
        <button type="button" className="passport__btn-save" onClick={onSave}>Сохранить</button>
        <button type="button" className="passport__btn-cancel" onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
}
