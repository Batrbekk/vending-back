'use client';

import { useEffect, useState } from 'react';
import { SwaggerWrapper } from '@/components/swagger/SwaggerWrapper';

export default function ApiDocsPage() {
  const [swaggerSpec, setSwaggerSpec] = useState<object | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSwaggerSpec = async () => {
      try {
        const response = await fetch('/api/swagger');
        if (!response.ok) {
          throw new Error('Не удалось загрузить спецификацию API');
        }
        const spec = await response.json();
        setSwaggerSpec(spec);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Произошла ошибка');
      } finally {
        setLoading(false);
      }
    };

    fetchSwaggerSpec();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-lg">Загрузка документации API...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Ошибка загрузки</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gray-50 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-3xl font-bold text-gray-900">API Документация</h1>
          <p className="mt-2 text-gray-600">
            Документация для API системы управления торговыми автоматами
          </p>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto">
        {swaggerSpec && (
          <SwaggerWrapper 
            spec={swaggerSpec}
          docExpansion="list"
          defaultModelsExpandDepth={2}
          defaultModelExpandDepth={2}
          displayRequestDuration={true}
          tryItOutEnabled={true}
          supportedSubmitMethods={['get', 'post', 'put', 'delete', 'patch']}
          deepLinking={true}
          showExtensions={true}
          showCommonExtensions={true}
          filter={true}
          requestInterceptor={(request: { url: string }) => {
            // Добавляем базовый URL если его нет
            if (!request.url.startsWith('http')) {
              request.url = `${window.location.origin}${request.url}`;
            }
            return request;
          }}
          responseInterceptor={(response: unknown) => {
            return response;
          }}
          />
        )}
      </div>
    </div>
  );
}
