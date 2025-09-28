'use client';

import { useEffect, useRef } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { suppressReactWarnings } from '@/lib/swagger/suppressWarnings';

interface SwaggerWrapperProps {
  spec: object;
  [key: string]: unknown;
}

export function SwaggerWrapper({ spec, ...props }: SwaggerWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Подавляем предупреждения React о устаревших методах
    const restoreWarnings = suppressReactWarnings();

    // Восстанавливаем оригинальные функции при размонтировании
    return restoreWarnings;
  }, []);

  return (
    <div ref={containerRef}>
      <SwaggerUI 
        spec={spec}
        {...props}
      />
    </div>
  );
}
