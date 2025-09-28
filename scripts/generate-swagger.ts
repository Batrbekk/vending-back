#!/usr/bin/env tsx

/**
 * Скрипт для генерации Swagger спецификации из JSDoc комментариев
 * Использование: yarn generate-swagger
 */

import swaggerJSDoc from 'swagger-jsdoc';
import fs from 'fs';
import path from 'path';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Vending Machine API',
      version: '1.0.0',
      description: 'API для системы управления торговыми автоматами',
      contact: {
        name: 'API Support',
        email: 'support@vending.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'auth-token'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      },
      {
        cookieAuth: []
      }
    ]
  },
  apis: [
    './app/api/**/*.ts',
    './lib/validation/**/*.ts',
    './lib/swagger/schemas.ts'
  ]
};

async function generateSwaggerSpec() {
  try {
    console.log('🔄 Генерация Swagger спецификации...');
    
    const spec = swaggerJSDoc(options);
    
    // Проверяем, что спецификация сгенерировалась корректно
    if (!spec || !spec.paths) {
      throw new Error('Не удалось сгенерировать спецификацию');
    }
    
    // Сохраняем в файл
    const outputPath = path.join(process.cwd(), 'lib/swagger/generated-spec.json');
    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
    
    console.log('✅ Swagger спецификация сгенерирована успешно');
    console.log(`📁 Сохранена в: ${outputPath}`);
    console.log(`📊 Найдено эндпоинтов: ${Object.keys(spec.paths).length}`);
    console.log(`📋 Найдено схем: ${Object.keys(spec.components?.schemas || {}).length}`);
    
    // Выводим статистику
    const endpoints = Object.keys(spec.paths);
    const methods = endpoints.flatMap(path => Object.keys(spec.paths[path]));
    
    console.log('\n📈 Статистика:');
    console.log(`- Всего эндпоинтов: ${endpoints.length}`);
    console.log(`- Всего методов: ${methods.length}`);
    console.log(`- GET: ${methods.filter(m => m === 'get').length}`);
    console.log(`- POST: ${methods.filter(m => m === 'post').length}`);
    console.log(`- PUT: ${methods.filter(m => m === 'put').length}`);
    console.log(`- DELETE: ${methods.filter(m => m === 'delete').length}`);
    
  } catch (error) {
    console.error('❌ Ошибка при генерации Swagger спецификации:', error);
    process.exit(1);
  }
}

// Запускаем генерацию
generateSwaggerSpec();
