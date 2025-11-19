/**
 * 数据验证工具
 * 提供统一的表单验证和数据校验功能
 */

const Constants = require('./constants');
const { logger } = require('./logger');

class Validator {
  constructor() {
    this.rules = new Map();
    this.customValidators = new Map();
    this.initDefaultRules();
  }

  /**
   * 初始化默认验证规则
   * @private
   */
  initDefaultRules() {
    // 手机号验证
    this.addRule('phone', {
      required: true,
      pattern: Constants.VALIDATION.PHONE_REGEX,
      message: '请输入有效的手机号码'
    });

    // 密码验证
    this.addRule('password', {
      required: true,
      minLength: Constants.VALIDATION.PASSWORD_MIN_LENGTH,
      message: `密码长度至少${Constants.VALIDATION.PASSWORD_MIN_LENGTH}位`
    });

    // 姓名验证
    this.addRule('name', {
      required: true,
      minLength: Constants.VALIDATION.NAME_MIN_LENGTH,
      maxLength: Constants.VALIDATION.NAME_MAX_LENGTH,
      message: `姓名长度应在${Constants.VALIDATION.NAME_MIN_LENGTH}-${Constants.VALIDATION.NAME_MAX_LENGTH}个字符之间`
    });

    // 邮箱验证
    this.addRule('email', {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: '请输入有效的邮箱地址'
    });

    // 数字验证
    this.addRule('number', {
      required: true,
      min: 0,
      message: '请输入有效的数字'
    });

    // 正整数验证
    this.addRule('positiveInt', {
      required: true,
      pattern: /^[1-9]\d*$/,
      message: '请输入正整数'
    });

    // 日期验证
    this.addRule('date', {
      pattern: /^\d{4}-\d{2}-\d{2}$/,
      message: '请输入有效的日期格式 (YYYY-MM-DD)'
    });

    // 时间验证
    this.addRule('time', {
      pattern: /^\d{2}:\d{2}$/,
      message: '请输入有效的时间格式 (HH:MM)'
    });
  }

  /**
   * 添加验证规则
   * @param {string} ruleName - 规则名称
   * @param {object} rule - 验证规则配置
   */
  addRule(ruleName, rule) {
    this.rules.set(ruleName, rule);
  }

  /**
   * 添加自定义验证器
   * @param {string} validatorName - 验证器名称
   * @param {function} validatorFn - 验证函数
   */
  addValidator(validatorName, validatorFn) {
    this.customValidators.set(validatorName, validatorFn);
  }

  /**
   * 验证单个值
   * @param {any} value - 要验证的值
   * @param {string|object} rule - 验证规则
   * @returns {object} 验证结果
   */
  validateValue(value, rule) {
    let ruleObj = rule;

    if (typeof rule === 'string') {
      ruleObj = this.rules.get(rule);
      if (!ruleObj) {
        throw new Error(`Validation rule '${rule}' not found`);
      }
    }

    const result = {
      valid: true,
      message: '',
      errors: []
    };

    // 检查必填字段
    if (ruleObj.required) {
      if (value === null || value === undefined || value === '') {
        result.valid = false;
        result.message = ruleObj.message || '此字段为必填项';
        result.errors.push('required');
        return result;
      }
    }

    // 如果值为空且不是必填项，则验证通过
    if (!value && !ruleObj.required) {
      return result;
    }

    // 字符串长度验证
    if (ruleObj.minLength !== undefined && typeof value === 'string') {
      if (value.length < ruleObj.minLength) {
        result.valid = false;
        result.message = ruleObj.message || `长度至少${ruleObj.minLength}个字符`;
        result.errors.push('minLength');
      }
    }

    if (ruleObj.maxLength !== undefined && typeof value === 'string') {
      if (value.length > ruleObj.maxLength) {
        result.valid = false;
        result.message = ruleObj.message || `长度不能超过${ruleObj.maxLength}个字符`;
        result.errors.push('maxLength');
      }
    }

    // 数字范围验证
    if (ruleObj.min !== undefined) {
      const num = parseFloat(value);
      if (isNaN(num) || num < ruleObj.min) {
        result.valid = false;
        result.message = ruleObj.message || `值不能小于${ruleObj.min}`;
        result.errors.push('min');
      }
    }

    if (ruleObj.max !== undefined) {
      const num = parseFloat(value);
      if (isNaN(num) || num > ruleObj.max) {
        result.valid = false;
        result.message = ruleObj.message || `值不能大于${ruleObj.max}`;
        result.errors.push('max');
      }
    }

    // 正则表达式验证
    if (ruleObj.pattern) {
      if (!ruleObj.pattern.test(value)) {
        result.valid = false;
        result.message = ruleObj.message || '格式不正确';
        result.errors.push('pattern');
      }
    }

    // 自定义验证函数
    if (ruleObj.custom) {
      try {
        const customResult = ruleObj.custom(value);
        if (!customResult) {
          result.valid = false;
          result.message = ruleObj.message || '验证失败';
          result.errors.push('custom');
        }
      } catch (error) {
        result.valid = false;
        result.message = '验证过程出错';
        result.errors.push('customError');
        logger.error('Custom validation error:', error);
      }
    }

    return result;
  }

  /**
   * 验证对象
   * @param {object} data - 要验证的数据对象
   * @param {object} schema - 验证模式
   * @returns {object} 验证结果
   */
  validate(data, schema) {
    const result = {
      valid: true,
      errors: {},
      messages: []
    };

    for (const field in schema) {
      const fieldSchema = schema[field];
      const value = data[field];
      const fieldResult = this.validateValue(value, fieldSchema);

      if (!fieldResult.valid) {
        result.valid = false;
        result.errors[field] = fieldResult.errors;
        result.messages.push(`${field}: ${fieldResult.message}`);
      }
    }

    return result;
  }

  /**
   * 异步验证
   * @param {object} data - 要验证的数据
   * @param {object} schema - 验证模式
   * @returns {Promise} 验证结果Promise
   */
  async validateAsync(data, schema) {
    return new Promise((resolve) => {
      try {
        const result = this.validate(data, schema);
        resolve(result);
      } catch (error) {
        logger.error('Async validation error:', error);
        resolve({
          valid: false,
          errors: { _error: ['validation_error'] },
          messages: ['验证过程中发生错误']
        });
      }
    });
  }

  /**
   * 批量验证
   * @param {Array} items - 要验证的数据项
   * @param {string|object} rule - 验证规则
   * @returns {Array} 验证结果数组
   */
  validateBatch(items, rule) {
    return items.map((item, index) => {
      const result = this.validateValue(item, rule);
      return {
        index,
        valid: result.valid,
        errors: result.errors,
        message: result.message,
        item
      };
    });
  }

  /**
   * 实时验证（用于输入框）
   * @param {any} value - 当前输入值
   * @param {string|object} rule - 验证规则
   * @returns {object} 验证结果
   */
  realtimeValidate(value, rule) {
    // 实时验证时，不检查必填性，只验证格式
    const realtimeRule = { ...rule };
    realtimeRule.required = false;

    return this.validateValue(value, realtimeRule);
  }

  /**
   * 清理错误信息
   * @param {string} message - 原始错误信息
   * @returns {string} 清理后的错误信息
   */
  sanitizeErrorMessage(message) {
    return message.replace(/[\r\n\t]/g, ' ').trim();
  }
}

// 创建全局验证器实例
const validator = new Validator();

// 常用的业务验证模式
const ValidationSchemas = {
  // 用户登录
  LOGIN: {
    phone: 'phone',
    name: {
      required: true,
      minLength: Constants.VALIDATION.NAME_MIN_LENGTH,
      maxLength: Constants.VALIDATION.NAME_MAX_LENGTH,
      message: '请输入有效的姓名'
    }
  },

  // 创建活动
  CREATE_ACTIVITY: {
    title: {
      required: true,
      minLength: 2,
      maxLength: 50,
      message: '活动标题长度应在2-50个字符之间'
    },
    date: {
      required: true,
      pattern: /^\d{4}-\d{2}-\d{2}$/,
      message: '请输入有效的活动日期'
    },
    time: {
      required: true,
      pattern: /^\d{2}:\d{2}$/,
      message: '请输入有效的活动时间'
    },
    maxPlayers: {
      required: true,
      min: 1,
      max: Constants.BUSINESS.MAX_ACTIVITY_PARTICIPANTS,
      message: `参与人数应在1-${Constants.BUSINESS.MAX_ACTIVITY_PARTICIPANTS}之间`
    },
    description: {
      maxLength: 200,
      message: '活动描述不能超过200个字符'
    }
  },

  // 充值金额
  RECHARGE: {
    amount: {
      required: true,
      min: Constants.BUSINESS.MIN_RECHARGE_AMOUNT,
      max: 10000,
      message: `充值金额应在${Constants.BUSINESS.MIN_RECHARGE_AMOUNT}-10000元之间`
    }
  },

  // 店铺状态
  STORE_STATUS: {
    openTime: {
      pattern: /^\d{2}:\d{2}$/,
      message: '请输入有效的开门时间'
    },
    closeTime: {
      pattern: /^\d{2}:\d{2}$/,
      message: '请输入有效的关门时间'
    }
  }
};

module.exports = {
  validator,
  ValidationSchemas,
  Validator
};
