import { Link } from 'react-router-dom';
import { PillLink } from '../../shared/ui';
import { SiteLayout } from '../../shared/layout/SiteLayout';
import { Mascot } from './SiteArt';
import './Main.css';

// Лендинг: design/project/Main.dc.html. Тексты дословно из эталона.

const STEPS = [
  { n: '01', title: 'Расскажите о проекте', text: 'Загрузите презентацию или описание в PDF, DOCX, PPTX. Файлов нет — ответьте на анкету.' },
  { n: '02', title: 'Буха собирает паспорт', text: 'Раскладывает сведения по 10 блокам и размечает каждое утверждение.' },
  { n: '03', title: 'Закрываете пробелы', text: 'Отвечаете на точные вопросы и видите пример, как обычно пишут в заявках.' },
  { n: '04', title: 'Получаете итог', text: 'Статус допуска, стоп-факторы, чек-лист документов и паспорт в DOCX и PDF.' },
];

const BLOCKS = [
  'Основатель и статус обучения',
  'Команда, роли и опыт',
  'Проблема и пользователи',
  'Продукт и технология',
  'Стадия и задел',
  'Аналоги и новизна',
  'Рынок, продажи и пилоты',
  'Юрлица и их роли',
  'Авторы, права и РИД',
  'Поддержка и обязательства',
];

const LEGEND = [
  { label: 'Факт с документом', swatch: 'doc' },
  { label: 'Факт без документа', swatch: 'nodoc' },
  { label: 'План', swatch: 'plan' },
  { label: 'Гипотеза', swatch: 'hypothesis' },
  { label: 'Со слов команды', swatch: 'hearsay' },
];

const FAQ = [
  { q: 'Буха гарантирует победу в конкурсе?', a: 'Нет. Буха помогает честно и полно описать проект и заранее увидеть формальные стоп-факторы. Решение принимает фонд.' },
  { q: 'Почему один аккаунт — один проект?', a: 'Паспорт привязан к описанию вашего проекта. Если загрузить материалы другого проекта, система их не примет — так паспорт не смешивает чужие факты с вашими.' },
  { q: 'Какие файлы можно загрузить?', a: 'PDF, DOCX и PPTX, включая сканы. Загрузка доступна на тарифах «Профессиональный» и «Премиум».' },
  { q: 'Что будет с паспортом, когда закончится подписка?', a: 'Паспорт, файлы и экспорт останутся. Новые загрузки и проверка новизны станут доступны после продления.' },
  { q: 'Это официальный сервис фонда?', a: 'Нет. Буха — независимый сервис подготовки. Заявка подаётся в официальной системе фонда.' },
];

// Иконка из линий эталона: 56 px, обводка акцентным оранжевым (класс main__feature-icon).
function FeatureIcon({ paths }: { paths: string[] }) {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="main__feature-icon">
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function Main() {
  return (
    <SiteLayout>
      <section className="main__hero">
        <div className="main__hero-text">
          <p className="main__eyebrow">Для команд, которые идут на «Студенческий стартап» ФСИ</p>
          <h1 className="t-display main__hero-title">Соберите паспорт проекта для гранта. Без приукрашивания</h1>
          <p className="main__hero-lead">Расскажите идею или загрузите презентацию. Буха разложит всё по 10 блокам, отделит факты от планов, найдёт пробелы и покажет, что мешает допуску к конкурсу.</p>
          <div className="main__hero-actions">
            <PillLink to="/auth" size="xl">
              Собрать паспорт бесплатно
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="main__arrow">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </PillLink>
            <Link to="/pricing" className="main__text-link">Посмотреть тарифы</Link>
          </div>
          <p className="main__fine">Бесплатно: анкета и паспорт по 10 блокам. Карта не нужна.</p>
        </div>

        <div className="main__visual">
          <div className="main__visual-bg" />
          <div className="main__visual-mark">
            <Mascot size={96} variant="bare" />
          </div>
          <div className="main__visual-card">
            <div className="main__visual-card-head">
              <span className="main__visual-block">Блок 7 · Рынок, продажи и пилоты</span>
              <span className="main__visual-status">Нужна проверка</span>
            </div>
            <p className="main__visual-text">
              Команда получила <span className="main__mark main__mark--doc">выручку 10 000 рублей</span> и провела{' '}
              <span className="main__mark main__mark--nodoc">две фокус-группы по 25 участников</span>. В 2027 году{' '}
              <span className="main__mark main__mark--plan">планируются три платных пилота</span>.
            </p>
            <div className="main__tags">
              <span className="main__tag">Факт · презентация, стр. 10</span>
              <span className="main__tag">Факт без документа</span>
              <span className="main__tag">План</span>
            </div>
          </div>
          <div className="main__visual-warning">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="main__warning-icon">
              <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span>План продаж не попадёт в достижения</span>
          </div>
        </div>
      </section>

      <section className="main__features">
        <div className="main__feature">
          <FeatureIcon paths={['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5', 'M9 14l2 2 4-4']} />
          <h3 className="main__feature-title">Факт, план или гипотеза</h3>
          <p className="main__feature-text">Каждое утверждение помечено. План продаж не превратится в выручку.</p>
        </div>
        <div className="main__feature">
          <FeatureIcon paths={['M21.4 11.1l-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8']} />
          <h3 className="main__feature-title">Источник у каждого факта</h3>
          <p className="main__feature-text">Файл, страница и цитата: видно, откуда взялась каждая цифра.</p>
        </div>
        <div className="main__feature">
          <FeatureIcon paths={['M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z', 'M12 8v5', 'M12 16h.01']} />
          <h3 className="main__feature-title">Стоп-факторы до подачи</h3>
          <p className="main__feature-text">Статус заявителя, права на РИД, аналоги: проверяем по правилам программы.</p>
        </div>
      </section>

      <section id="how" className="main__section main__section--how">
        <h2 className="t-title">Как это работает</h2>
        <div className="main__steps">
          {STEPS.map((step, index) => (
            <div key={step.n} className={index === STEPS.length - 1 ? 'main__step main__step--accent' : 'main__step'}>
              <span className="main__step-num">{step.n}</span>
              <h3 className="main__step-title">{step.title}</h3>
              <p className="main__step-text">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="passport" className="main__section main__section--passport">
        <div className="main__passport-head">
          <h2 className="t-title main__passport-title">Эксперт фонда заметит приукрашивание. Буха — раньше</h2>
          <p className="main__passport-lead">ИИ работает только с тем, что вы дали. Всё, чего нет в материалах, превращается в вопрос, а не в красивую фразу.</p>
        </div>
        <div className="main__passport-grid">
          <div className="main__panel main__panel--muted main__panel--tall">
            <h3 className="main__panel-title">Видно, что доказано, а что — слова</h3>
            <p className="main__panel-text">Четыре типа сведений и статус проверки у каждого утверждения.</p>
            <div className="main__legend">
              {LEGEND.map((item) => (
                <span key={item.swatch} className="main__legend-item">
                  <span className={`main__swatch main__swatch--${item.swatch}`} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <div className="main__panel main__panel--terracotta main__panel--tall">
            <h3 className="main__panel-title">ИИ не дописывает достижения</h3>
            <p className="main__panel-text main__panel-text--peach">Нет в материалах охвата, выручки или пилота — Буха не придумает их, а спросит.</p>
            <div className="main__panel-box main__panel-box--deep">
              <span className="main__struck">Сервисом воспользуются 10 000 человек</span>
              <span className="main__question">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="main__question-icon">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5M12 16h.01" />
                </svg>
                Нет в материалах. Вопрос: сколько пользователей уже прошло пилот?
              </span>
            </div>
          </div>

          <div className="main__panel main__panel--peach">
            <h3 className="main__panel-title">Новизна — минимум два аналога</h3>
            <p className="main__panel-text">Сравнение по конкретным параметрам и способ измеримой проверки, как требует фонд.</p>
            <div className="main__panel-box">
              <span className="main__count">1 / 2</span>
              <span className="main__count-text">Указан один аналог. Добавьте ещё один и измеримое отличие.</span>
            </div>
          </div>

          <div className="main__panel main__panel--muted">
            <h3 className="main__panel-title">Поправили текст — связи пересчитаются</h3>
            <p className="main__panel-text">Если после правки цифра потеряла источник, поле вернётся на проверку, а согласование снимется.</p>
            <div className="main__panel-box main__panel-box--row">
              <span className="main__lost-dot" />
              <span className="main__count-text">2 утверждения потеряли привязку к тексту</span>
            </div>
          </div>
        </div>
      </section>

      <section className="main__section main__section--blocks">
        <h2 className="t-title">10 блоков паспорта</h2>
        <div className="main__blocks">
          {BLOCKS.map((title, index) => (
            <div key={title} className="main__block">
              <span className="main__block-num">{String(index + 1).padStart(2, '0')}</span>
              <span className="main__block-title">{title}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="main__section main__section--tariffs">
        <div className="main__tariffs-head">
          <h2 className="t-title">Тарифы</h2>
          <Link to="/pricing" className="main__compare-link">Сравнить все возможности</Link>
        </div>
        <div className="main__tariff-grid">
          <div className="main__tariff">
            <h3 className="main__tariff-name">Базовый</h3>
            <p className="main__tariff-text">Анкета и паспорт по 10 блокам</p>
            <p className="main__tariff-price">0 ₽</p>
          </div>
          <div className="main__tariff main__tariff--featured">
            <span className="main__tariff-badge">Рекомендуем</span>
            <h3 className="main__tariff-name">Профессиональный</h3>
            <p className="main__tariff-text">Разбор презентаций, до 10 файлов, проверка новизны</p>
            <p className="main__tariff-price">990 ₽ за 30 дней</p>
          </div>
          <div className="main__tariff">
            <h3 className="main__tariff-name">Премиум</h3>
            <p className="main__tariff-text">До 50 файлов и консультант</p>
            <p className="main__tariff-price">4 990 ₽ за 30 дней</p>
          </div>
        </div>
      </section>

      <section id="faq" className="main__section main__section--faq">
        <h2 className="t-title">Вопросы</h2>
        <div className="main__faq">
          {FAQ.map((item) => (
            <details key={item.q} className="main__faq-item">
              <summary className="main__faq-q">{item.q}</summary>
              <p className="main__faq-a">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="main__cta-wrap">
        <div className="main__cta">
          <div className="main__cta-text">
            <h2 className="t-title main__cta-title">Начните с того, что уже есть</h2>
            <p className="main__cta-lead">Пара абзацев об идее — и через несколько минут у вас черновик паспорта и список вопросов.</p>
            <PillLink to="/auth" variant="ink" size="lg" className="main__cta-button">Собрать паспорт бесплатно</PillLink>
          </div>
          <Mascot size={200} variant="tile" />
        </div>
      </section>
    </SiteLayout>
  );
}
