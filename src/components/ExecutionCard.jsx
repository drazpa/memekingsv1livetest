import { useState } from 'react';

export default function ExecutionCard({ execution, onExecute, onCancel }) {
  const [formData, setFormData] = useState(execution.defaultValues || {});
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    setCurrentStep(0);

    try {
      for (let i = 0; i < execution.steps.length; i++) {
        setCurrentStep(i);
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      await onExecute(formData);
      setCurrentStep(execution.steps.length);
    } catch (error) {
      console.error('Execution error:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-purple-500/40"
      style={{
        background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.95), rgba(59, 7, 100, 0.95))',
        backdropFilter: 'blur(20px)'
      }}
    >
      <div className="p-4 border-b border-purple-500/30 bg-purple-900/40">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{execution.icon}</div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white">{execution.title}</h3>
            <p className="text-purple-300/80 text-sm">{execution.description}</p>
          </div>
          {execution.badge && (
            <span className="px-3 py-1 bg-purple-600/40 text-purple-200 text-xs font-medium rounded-full border border-purple-500/30">
              {execution.badge}
            </span>
          )}
        </div>
      </div>

      {execution.fields && execution.fields.length > 0 && (
        <div className="p-4 space-y-3 bg-purple-900/20">
          {execution.fields.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-purple-200 mb-1">
                {field.label}
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              {field.type === 'select' ? (
                <select
                  value={formData[field.name] || ''}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  className="w-full bg-purple-950/60 border border-purple-500/40 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/30"
                  disabled={isExecuting}
                >
                  <option value="">Select {field.label}</option>
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  value={formData[field.name] || ''}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full bg-purple-950/60 border border-purple-500/40 rounded-lg px-3 py-2 text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/30 resize-none"
                  rows="3"
                  disabled={isExecuting}
                />
              ) : (
                <input
                  type={field.type || 'text'}
                  value={formData[field.name] || ''}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full bg-purple-950/60 border border-purple-500/40 rounded-lg px-3 py-2 text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/30"
                  disabled={isExecuting}
                />
              )}
              {field.hint && (
                <p className="text-xs text-purple-400/60 mt-1">{field.hint}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {execution.steps && execution.steps.length > 0 && (
        <div className="p-4 space-y-2 bg-purple-900/10 border-t border-purple-500/20">
          <div className="text-xs font-medium text-purple-300 mb-2">Execution Steps:</div>
          {execution.steps.map((step, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-300 ${
                isExecuting && index === currentStep
                  ? 'bg-purple-600/30 border border-purple-500/40 animate-pulse'
                  : isExecuting && index < currentStep
                  ? 'bg-green-600/20 border border-green-500/30'
                  : 'bg-purple-900/20 border border-purple-500/10'
              }`}
            >
              <div className="flex-shrink-0">
                {isExecuting && index < currentStep ? (
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                ) : isExecuting && index === currentStep ? (
                  <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <div className="w-5 h-5 bg-purple-700/30 rounded-full flex items-center justify-center text-purple-400 text-xs font-bold">
                    {index + 1}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className={`text-sm ${
                  isExecuting && index === currentStep
                    ? 'text-white font-medium'
                    : isExecuting && index < currentStep
                    ? 'text-green-300'
                    : 'text-purple-300/80'
                }`}>
                  {step.label}
                </div>
                {step.description && (
                  <div className="text-xs text-purple-400/60 mt-0.5">{step.description}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 bg-purple-900/30 border-t border-purple-500/20 flex gap-2">
        <button
          onClick={handleExecute}
          disabled={isExecuting || !execution.fields?.every(f => !f.required || formData[f.name])}
          className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/50 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2"
        >
          {isExecuting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Executing...
            </>
          ) : (
            <>
              <span>Execute</span>
              <span>➤</span>
            </>
          )}
        </button>
        {onCancel && !isExecuting && (
          <button
            onClick={onCancel}
            className="px-4 py-2.5 bg-purple-800/40 hover:bg-purple-800/60 text-purple-200 rounded-lg font-medium transition-all duration-200 border border-purple-500/30"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
