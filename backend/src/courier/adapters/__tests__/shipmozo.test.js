"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var axios_1 = require("axios");
var shipmozo_1 = require("../shipmozo");
jest.mock('axios');
var mockedAxios = axios_1.default;
describe('ShipmozoAdapter', function () {
    var adapter;
    beforeEach(function () {
        adapter = new shipmozo_1.ShipmozoAdapter();
        jest.clearAllMocks();
    });
    it('should fetch a quote correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
        var quote;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockedAxios.post.mockResolvedValueOnce({
                        data: { rate: '150.50' }
                    });
                    return [4 /*yield*/, adapter.getQuote({
                            originPincode: '110001',
                            destinationPincode: '400001',
                            weightGrams: 500
                        })];
                case 1:
                    quote = _a.sent();
                    expect(quote.courierId).toBe('shipmozo');
                    expect(quote.price).toBe(150.50);
                    expect(mockedAxios.post).toHaveBeenCalledWith('https://shipping-api.com/app/api/v1/rate-calculator', expect.objectContaining({
                        pickup_pincode: '110001',
                        delivery_pincode: '400001',
                        weight: '500'
                    }), expect.any(Object));
                    return [2 /*return*/];
            }
        });
    }); });
    it('should create a shipment correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
        var shipment;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockedAxios.post.mockResolvedValueOnce({
                        data: { data: { refrence_id: 'TRK123456' } }
                    });
                    return [4 /*yield*/, adapter.createShipment({
                            orderId: 'ORD-001',
                            courierId: 'shipmozo',
                            pickupAddress: { name: 'Store', phone: '12345', pincode: '110001', address: 'Delhi' },
                            deliveryAddress: { name: 'John Doe', phone: '9876543210', pincode: '400001', address: 'Mumbai' },
                            items: [{ title: 'Book', quantity: 2, price: 500 }],
                            weightGrams: 1000,
                            paymentMethod: 'prepaid',
                            amount: 1000
                        })];
                case 1:
                    shipment = _a.sent();
                    expect(shipment.trackingId).toBe('TRK123456');
                    expect(mockedAxios.post).toHaveBeenCalledWith('https://shipping-api.com/app/api/v1/push-order', expect.objectContaining({
                        order_id: 'ORD-001',
                        consignee_name: 'John Doe'
                    }), expect.any(Object));
                    return [2 /*return*/];
            }
        });
    }); });
    it('should fetch a label correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
        var label;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockedAxios.get.mockResolvedValueOnce({
                        data: { data: { label_url: 'https://shipping-api.com/label.pdf' } }
                    });
                    return [4 /*yield*/, adapter.getLabel('TRK123456')];
                case 1:
                    label = _a.sent();
                    expect(label.labelUrl).toBe('https://shipping-api.com/label.pdf');
                    expect(mockedAxios.get).toHaveBeenCalledWith('https://shipping-api.com/app/api/v1/get-order-label/TRK123456?type_of_label=PDF', expect.any(Object));
                    return [2 /*return*/];
            }
        });
    }); });
    it('should handle cancellation correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
        var cancel;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockedAxios.post.mockResolvedValueOnce({
                        data: { result: '1', message: 'Success' }
                    });
                    return [4 /*yield*/, adapter.cancelShipment('TRK123456', 'ORD-001')];
                case 1:
                    cancel = _a.sent();
                    expect(cancel.success).toBe(true);
                    expect(mockedAxios.post).toHaveBeenCalledWith('https://shipping-api.com/app/api/v1/cancel-order', { order_id: 'ORD-001', awb_number: 'TRK123456' }, expect.any(Object));
                    return [2 /*return*/];
            }
        });
    }); });
    it('should track shipment correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
        var tracking;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockedAxios.get.mockResolvedValueOnce({
                        data: { status: 'Delivered' }
                    });
                    return [4 /*yield*/, adapter.trackShipment('TRK123456')];
                case 1:
                    tracking = _a.sent();
                    expect(tracking.status).toBe('Delivered');
                    expect(mockedAxios.get).toHaveBeenCalledWith('https://shipping-api.com/app/api/v1/track-order?awb_number=TRK123456', expect.any(Object));
                    return [2 /*return*/];
            }
        });
    }); });
});
