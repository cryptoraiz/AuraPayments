

export default function FAQItem({ question, answer, isOpen, onToggle }) {
  return (
    <div
      className={`arc-card-subtle p-4 rounded-xl cursor-pointer group ${isOpen
        ? 'border-blue-500/30'
        : 'hover:border-blue-500/40'
        }`}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className={`font-bold text-sm transition-colors duration-300 ${isOpen ? 'text-blue-400' : 'text-white group-hover:text-blue-200'}`}>
          {question}
        </h3>
        <svg
          className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-400' : 'text-gray-400 group-hover:text-blue-400'}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'
          }`}
      >
        <div className="overflow-hidden">
          <div className="text-xs text-gray-400 leading-relaxed max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 pr-2 whitespace-pre-line">
            {answer}
          </div>
        </div>
      </div>
    </div>
  )
}
