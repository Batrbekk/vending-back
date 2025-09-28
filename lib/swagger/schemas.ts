/**
 * @swagger
 * components:
 *   schemas:
 *     Error:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Ошибка валидации"
 *         timestamp:
 *           type: string
 *           format: date-time
 *     
 *     Success:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *         timestamp:
 *           type: string
 *           format: date-time
 *     
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *         name:
 *           type: string
 *           example: "Иван Иванов"
 *         role:
 *           type: string
 *           enum: [admin, manager, operator]
 *           example: "operator"
 *         phone:
 *           type: string
 *           example: "+7 (999) 123-45-67"
 *         isActive:
 *           type: boolean
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     LoginRequest:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *         password:
 *           type: string
 *           format: password
 *           example: "password123"
 *     
 *     LoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             accessToken:
 *               type: string
 *               example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *             user:
 *               $ref: '#/components/schemas/User'
 *         timestamp:
 *           type: string
 *           format: date-time
 *     
 *     CreateUserRequest:
 *       type: object
 *       required: [email, password, name]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "newuser@example.com"
 *         password:
 *           type: string
 *           format: password
 *           minLength: 6
 *           example: "password123"
 *         name:
 *           type: string
 *           example: "Новый Пользователь"
 *         role:
 *           type: string
 *           enum: [admin, manager, operator]
 *           default: manager
 *           example: "manager"
 *         phone:
 *           type: string
 *           example: "+7 (999) 123-45-67"
 *     
 *     VendingMachine:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *         name:
 *           type: string
 *           example: "Автомат #001"
 *         location:
 *           type: string
 *           example: "Торговый центр, 1 этаж"
 *         status:
 *           type: string
 *           enum: [active, inactive, maintenance]
 *           example: "active"
 *         lastHeartbeat:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     Sale:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *         machineId:
 *           type: string
 *           example: "507f1f77bcf86cd799439012"
 *         productName:
 *           type: string
 *           example: "Кока-Кола 0.5л"
 *         price:
 *           type: number
 *           format: float
 *           example: 50.0
 *         quantity:
 *           type: integer
 *           example: 1
 *         totalAmount:
 *           type: number
 *           format: float
 *           example: 50.0
 *         timestamp:
 *           type: string
 *           format: date-time
 *     
 *     Location:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *         name:
 *           type: string
 *           example: "Торговый центр 'Мега'"
 *         address:
 *           type: string
 *           example: "ул. Примерная, 123"
 *         city:
 *           type: string
 *           example: "Москва"
 *         coordinates:
 *           type: object
 *           properties:
 *             lat:
 *               type: number
 *               format: float
 *               example: 55.7558
 *             lng:
 *               type: number
 *               format: float
 *               example: 37.6176
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
