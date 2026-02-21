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
exports.ShipmozoAdapter = void 0;
var axios_1 = require("axios");
var couriers_1 = require("../../config/couriers");
var SHIPMOZO_BASE_URL = 'https://shipping-api.com/app/api/v1';
var PUBLIC_KEY = 'mjLZxH7eQSnTohF2rO8k';
var PRIVATE_KEY = 'ZXOUnx3JMC56FhEBNYG8';
var ShipmozoAdapter = /** @class */ (function () {
    function ShipmozoAdapter() {
        this.id = 'shipmozo';
        this.name = 'Shipmozo';
    }
    ShipmozoAdapter.prototype.isEnabled = function () {
        var _this = this;
        return (0, couriers_1.getEnabledCouriers)().some(function (c) { return c.id === _this.id; });
    };
    ShipmozoAdapter.prototype.getHeaders = function () {
        return {
            'public-key': PUBLIC_KEY,
            'private-key': PRIVATE_KEY,
            'Content-Type': 'application/json',
        };
    };
    ShipmozoAdapter.prototype.getQuote = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            var response, price, error_1;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, axios_1.default.post("".concat(SHIPMOZO_BASE_URL, "/rate-calculator"), {
                                pickup_pincode: payload.originPincode,
                                delivery_pincode: payload.destinationPincode,
                                weight: payload.weightGrams.toString(),
                                payment_type: "PREPAID",
                                shipment_type: "FORWARD"
                            }, { headers: this.getHeaders() })];
                    case 1:
                        response = _d.sent();
                        price = ((_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.rate) || ((_c = response.data) === null || _c === void 0 ? void 0 : _c.rate) || 0;
                        return [2 /*return*/, {
                                courierId: this.id,
                                courierName: this.name,
                                price: parseFloat(price) || 0,
                                deliveryDays: 3, // fallback days
                                available: true,
                            }];
                    case 2:
                        error_1 = _d.sent();
                        console.error('Shipmozo getQuote error:', error_1);
                        return [2 /*return*/, {
                                courierId: this.id,
                                courierName: this.name,
                                price: 0,
                                deliveryDays: 0,
                                available: false,
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ShipmozoAdapter.prototype.createShipment = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            var shipmozoBody, response, error_2;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 2, , 3]);
                        shipmozoBody = {
                            order_id: payload.orderId,
                            order_date: new Date().toISOString().split('T')[0],
                            consignee_name: payload.deliveryAddress.name,
                            consignee_phone: payload.deliveryAddress.phone,
                            consignee_email: "customer@example.com", // Add generic email if not provided
                            consignee_address_line_one: payload.deliveryAddress.address,
                            consignee_pin_code: payload.deliveryAddress.pincode,
                            consignee_city: "Unknown", // Can be inferred or passed later if needed
                            consignee_state: "Unknown",
                            payment_type: payload.paymentMethod.toUpperCase(),
                            weight: payload.weightGrams.toString(),
                            product_detail: payload.items.map(function (item) { return ({
                                name: item.title,
                                sku_number: item.title.substring(0, 5),
                                quantity: item.quantity,
                                unit_price: item.price,
                            }); })
                        };
                        return [4 /*yield*/, axios_1.default.post("".concat(SHIPMOZO_BASE_URL, "/push-order"), shipmozoBody, { headers: this.getHeaders() })];
                    case 1:
                        response = _e.sent();
                        return [2 /*return*/, {
                                trackingId: ((_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.refrence_id) || ((_d = (_c = response.data) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.order_id) || payload.orderId,
                                courierName: this.name,
                                estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
                            }];
                    case 2:
                        error_2 = _e.sent();
                        console.error('Shipmozo createShipment error:', error_2);
                        throw new Error('Failed to create Shipmozo shipment');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ShipmozoAdapter.prototype.cancelShipment = function (trackingId, orderId) {
        return __awaiter(this, void 0, void 0, function () {
            var body, response, error_3;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        body = {
                            order_id: orderId || trackingId,
                            awb_number: trackingId
                        };
                        return [4 /*yield*/, axios_1.default.post("".concat(SHIPMOZO_BASE_URL, "/cancel-order"), body, { headers: this.getHeaders() })];
                    case 1:
                        response = _b.sent();
                        if (((_a = response.data) === null || _a === void 0 ? void 0 : _a.result) === "1") {
                            return [2 /*return*/, { success: true, message: response.data.message || 'Cancelled successfully' }];
                        }
                        return [2 /*return*/, { success: false, message: 'Failed to cancel order with Shipmozo' }];
                    case 2:
                        error_3 = _b.sent();
                        console.error('Shipmozo cancelShipment error:', error_3);
                        return [2 /*return*/, { success: false, message: 'API error during cancellation' }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ShipmozoAdapter.prototype.getLabel = function (trackingId, orderId) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_4;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, axios_1.default.get("".concat(SHIPMOZO_BASE_URL, "/get-order-label/").concat(trackingId, "?type_of_label=PDF"), { headers: this.getHeaders() })];
                    case 1:
                        response = _d.sent();
                        return [2 /*return*/, { labelUrl: ((_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.label_url) || ((_c = response.data) === null || _c === void 0 ? void 0 : _c.label_url) || '' }];
                    case 2:
                        error_4 = _d.sent();
                        console.error('Shipmozo getLabel error:', error_4);
                        return [2 /*return*/, { labelUrl: '' }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    ShipmozoAdapter.prototype.trackShipment = function (trackingId) {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, axios_1.default.get("".concat(SHIPMOZO_BASE_URL, "/track-order?awb_number=").concat(trackingId), { headers: this.getHeaders() })];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                    case 2:
                        error_5 = _a.sent();
                        console.error('Shipmozo trackShipment error:', error_5);
                        throw new Error("Tracking failed: ".concat(error_5));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return ShipmozoAdapter;
}());
exports.ShipmozoAdapter = ShipmozoAdapter;
