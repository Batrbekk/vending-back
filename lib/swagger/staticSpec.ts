import { OpenAPIV3 } from 'openapi-types';

export const staticSwaggerSpec: OpenAPIV3.Document = {
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
      url: process.env.NODE_ENV === 'production' 
        ? 'https://your-production-domain.com' 
        : 'http://localhost:3000',
      description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
    }
  ],
  tags: [
    {
      name: 'Auth',
      description: 'Аутентификация и авторизация'
    },
    {
      name: 'Users',
      description: 'Управление пользователями'
    },
    {
      name: 'Managers',
      description: 'Управление менеджерами'
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
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          message: {
            type: 'string',
            example: 'Ошибка валидации'
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      Success: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          data: {
            type: 'object'
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '507f1f77bcf86cd799439011'
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'user@example.com'
          },
          name: {
            type: 'string',
            example: 'Иван Иванов'
          },
          role: {
            type: 'string',
            enum: ['admin', 'manager', 'operator'],
            example: 'operator'
          },
          phone: {
            type: 'string',
            example: '+7 (999) 123-45-67'
          },
          isActive: {
            type: 'boolean',
            example: true
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      Manager: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            example: '507f1f77bcf86cd799439011'
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'manager@example.com'
          },
          name: {
            type: 'string',
            example: 'Иван Иванов'
          },
          role: {
            type: 'string',
            enum: ['MANAGER'],
            example: 'MANAGER'
          },
          phone: {
            type: 'string',
            example: '+7 (999) 123-45-67'
          },
          isActive: {
            type: 'boolean',
            example: true
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'user@example.com'
          },
          password: {
            type: 'string',
            format: 'password',
            example: 'password123'
          }
        }
      },
      LoginResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          data: {
            type: 'object',
            properties: {
              accessToken: {
                type: 'string',
                example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
              },
              user: {
                $ref: '#/components/schemas/User'
              }
            }
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          }
        }
      },
      CreateUserRequest: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            example: 'newuser@example.com'
          },
          password: {
            type: 'string',
            format: 'password',
            minLength: 6,
            example: 'password123'
          },
          name: {
            type: 'string',
            example: 'Новый Пользователь'
          },
          role: {
            type: 'string',
            enum: ['admin', 'manager', 'operator'],
            default: 'manager',
            example: 'manager'
          },
          phone: {
            type: 'string',
            example: '+7 (999) 123-45-67'
          }
        }
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
  ],
  paths: {
    '/api/auth/login': {
      post: {
        summary: 'Авторизация пользователя',
        description: 'Вход в систему с использованием email и пароля',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LoginRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Успешная авторизация',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/LoginResponse'
                }
              }
            },
            headers: {
              'Set-Cookie': {
                description: 'JWT токен в HttpOnly cookie',
                schema: {
                  type: 'string',
                  example: 'auth-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; HttpOnly; Path=/; SameSite=Strict'
                }
              }
            }
          },
          '400': {
            description: 'Некорректные данные формы',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '401': {
            description: 'Неверные учетные данные или заблокированный аккаунт',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '500': {
            description: 'Внутренняя ошибка сервера',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          }
        }
      }
    },
    '/api/auth/logout': {
      post: {
        summary: 'Выход из системы',
        description: 'Завершение сессии пользователя и очистка аутентификационных данных',
        tags: ['Auth'],
        security: [
          { bearerAuth: [] },
          { cookieAuth: [] }
        ],
        responses: {
          '200': {
            description: 'Успешный выход из системы',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      type: 'object',
                      properties: {
                        message: {
                          type: 'string',
                          example: 'Выход выполнен успешно'
                        }
                      }
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time'
                    }
                  }
                }
              }
            },
            headers: {
              'Set-Cookie': {
                description: 'Очистка JWT токена из cookie',
                schema: {
                  type: 'string',
                  example: 'auth-token=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0'
                }
              }
            }
          }
        }
      },
      get: {
        summary: 'Выход из системы (GET)',
        description: 'Альтернативный способ выхода из системы через GET запрос',
        tags: ['Auth'],
        security: [
          { bearerAuth: [] },
          { cookieAuth: [] }
        ],
        responses: {
          '200': {
            description: 'Успешный выход из системы',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      type: 'object',
                      properties: {
                        message: {
                          type: 'string',
                          example: 'Выход выполнен успешно'
                        }
                      }
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/auth/me': {
      get: {
        summary: 'Получение информации о текущем пользователе',
        description: 'Возвращает данные авторизованного пользователя',
        tags: ['Auth'],
        security: [
          { bearerAuth: [] },
          { cookieAuth: [] }
        ],
        responses: {
          '200': {
            description: 'Успешное получение данных пользователя',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      type: 'object',
                      properties: {
                        user: {
                          $ref: '#/components/schemas/User'
                        }
                      }
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time'
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Не авторизован',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '404': {
            description: 'Пользователь не найден',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '500': {
            description: 'Внутренняя ошибка сервера',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          }
        }
      }
    },
    '/api/users': {
      get: {
        summary: 'Получение списка пользователей',
        description: 'Возвращает список всех пользователей с фильтрацией и пагинацией (только для админов)',
        tags: ['Users'],
        security: [
          { bearerAuth: [] },
          { cookieAuth: [] }
        ],
        parameters: [
          {
            in: 'query',
            name: 'role',
            schema: {
              type: 'string',
              enum: ['admin', 'manager', 'operator']
            },
            description: 'Фильтр по роли пользователя'
          },
          {
            in: 'query',
            name: 'isActive',
            schema: {
              type: 'boolean'
            },
            description: 'Фильтр по активности пользователя'
          },
          {
            in: 'query',
            name: 'search',
            schema: {
              type: 'string'
            },
            description: 'Поиск по имени или email'
          },
          {
            in: 'query',
            name: 'page',
            schema: {
              type: 'integer',
              minimum: 1,
              default: 1
            },
            description: 'Номер страницы'
          },
          {
            in: 'query',
            name: 'limit',
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20
            },
            description: 'Количество записей на странице'
          }
        ],
        responses: {
          '200': {
            description: 'Успешное получение списка пользователей',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      type: 'object',
                      properties: {
                        users: {
                          type: 'array',
                          items: {
                            $ref: '#/components/schemas/User'
                          }
                        },
                        pagination: {
                          type: 'object',
                          properties: {
                            page: {
                              type: 'integer',
                              example: 1
                            },
                            limit: {
                              type: 'integer',
                              example: 20
                            },
                            totalCount: {
                              type: 'integer',
                              example: 100
                            },
                            totalPages: {
                              type: 'integer',
                              example: 5
                            },
                            hasNext: {
                              type: 'boolean',
                              example: true
                            },
                            hasPrev: {
                              type: 'boolean',
                              example: false
                            }
                          }
                        }
                      }
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time'
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Не авторизован',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '403': {
            description: 'Недостаточно прав (только для админов)',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '500': {
            description: 'Внутренняя ошибка сервера',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          }
        }
      },
      post: {
        summary: 'Создание нового пользователя',
        description: 'Создает нового пользователя в системе (только для админов)',
        tags: ['Users'],
        security: [
          { bearerAuth: [] },
          { cookieAuth: [] }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateUserRequest'
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Пользователь успешно создан',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true
                    },
                    data: {
                      type: 'object',
                      properties: {
                        user: {
                          $ref: '#/components/schemas/User'
                        }
                      }
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time'
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Некорректные данные формы',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '401': {
            description: 'Не авторизован',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '403': {
            description: 'Недостаточно прав (только для админов)',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '409': {
            description: 'Пользователь с таким email уже существует',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '500': {
            description: 'Внутренняя ошибка сервера',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          }
        }
      }
    }
  }
};
