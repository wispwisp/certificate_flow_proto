export type Step = 1 | 2 | 3

type Props = {
  step: Step
  canOpen: Record<Step, boolean>
  onStep: (step: Step) => void
  onHelp: () => void
}

const STEPS: [Step, string][] = [
  [1, '① Шаблон'],
  [2, '② Данные'],
  [3, '③ Документы'],
]

export default function Header({ step, canOpen, onStep, onHelp }: Props) {
  return (
    <header className="header">
      <nav className="steps">
        {STEPS.map(([n, label]) => (
          <button key={n} className={n === step ? 'step current' : 'step'} disabled={!canOpen[n]} onClick={() => onStep(n)}>
            {label}
          </button>
        ))}
      </nav>
      <button className="link" onClick={onHelp}>Как подготовить шаблон</button>
      <span className="privacy">Данные не покидают ваш браузер</span>
    </header>
  )
}
