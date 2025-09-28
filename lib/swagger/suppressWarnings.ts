/**
 * Подавляет предупреждения React о устаревших методах жизненного цикла
 * для внешних библиотек, таких как swagger-ui-react
 */
export function suppressReactWarnings() {
  if (typeof window === 'undefined') return;

  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  console.warn = (...args) => {
    const message = args[0];
    if (
      typeof message === 'string' && 
      (message.includes('UNSAFE_componentWillReceiveProps') || 
       message.includes('ModelCollapse') || 
       message.includes('OperationContainer') ||
       message.includes('componentWillReceiveProps') ||
       message.includes('componentWillMount'))
    ) {
      // Игнорируем предупреждения от swagger-ui-react
      return;
    }
    originalConsoleWarn.apply(console, args);
  };

  console.error = (...args) => {
    const message = args[0];
    if (
      typeof message === 'string' && 
      (message.includes('UNSAFE_componentWillReceiveProps') || 
       message.includes('ModelCollapse') || 
       message.includes('OperationContainer'))
    ) {
      // Игнорируем ошибки от swagger-ui-react
      return;
    }
    originalConsoleError.apply(console, args);
  };

  return () => {
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  };
}
