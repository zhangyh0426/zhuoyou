// 云函数：交易管理
// cloudfunctions/transactionManager/index.js

const cloud = require('wx-server-sdk');
const { getDatabaseManager } = require('../../utils/database');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const { action, data } = event;
  const dbManager = getDatabaseManager();

  try {
    // 确保数据库连接
    if (!dbManager.isHealthy()) {
      await dbManager.init();
    }

    switch (action) {
    case 'getTransactions':
      return await getTransactions(data, dbManager);
    case 'addTransaction':
      return await addTransaction(data, dbManager);
    case 'getBalance':
      return await getBalance(data, dbManager);
    case 'recharge':
      return await recharge(data, dbManager);
    case 'processPayment':
      return await processPayment(data, dbManager);
    case 'refund':
      return await refund(data, dbManager);
    default:
      throw new Error('未知操作');
    }
  } catch (error) {
    console.error('交易管理云函数错误:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 获取交易记录
async function getTransactions(data, dbManager) {
  const { userPhone, limit = 50 } = data;

  if (!userPhone) {
    throw new Error('用户手机号不能为空');
  }

  const transactions = await dbManager.getTransactions(userPhone, limit);

  return {
    success: true,
    data: transactions.map(t => ({
      id: t.id,
      type: t.type,
      amount: parseFloat(t.amount),
      balanceAfter: parseFloat(t.balance_after),
      description: t.description,
      referenceId: t.reference_id,
      referenceType: t.reference_type,
      status: t.status,
      createdAt: t.created_at
    }))
  };
}

// 添加交易记录
async function addTransaction(data, dbManager) {
  const { transactionData } = data;

  // 验证必填字段
  if (!transactionData.userPhone || !transactionData.type || transactionData.amount === undefined) {
    throw new Error('用户手机号、交易类型和金额为必填项');
  }

  // 获取当前余额
  const memberCard = await dbManager.getMemberCard(transactionData.userPhone);
  const currentBalance = memberCard ? parseFloat(memberCard.balance) : 0;

  // 计算交易后余额
  let balanceAfter = currentBalance;
  switch (transactionData.type) {
  case 'recharge':
  case 'bonus':
    balanceAfter += parseFloat(transactionData.amount);
    break;
  case 'payment':
  case 'penalty':
    balanceAfter -= parseFloat(transactionData.amount);
    break;
  case 'refund':
    balanceAfter += parseFloat(transactionData.amount);
    break;
  default:
    throw new Error('不支持的交易类型');
  }

  // 确保余额不会变为负数（除了扣费交易）
  if (balanceAfter < 0 && ['payment', 'penalty'].includes(transactionData.type)) {
    throw new Error('余额不足');
  }

  // 创建交易记录
  const transactionId = await dbManager.addTransaction({
    user_phone: transactionData.userPhone,
    type: transactionData.type,
    amount: transactionData.amount,
    balance_after: balanceAfter,
    description: transactionData.description || '',
    reference_id: transactionData.referenceId || null,
    reference_type: transactionData.referenceType || null,
    status: transactionData.status || 'completed'
  });

  // 更新会员卡余额
  await dbManager.saveMemberCard(transactionData.userPhone, {
    balance: balanceAfter,
    last_transaction_time: new Date()
  });

  return {
    success: true,
    data: {
      transactionId,
      balanceAfter,
      message: '交易记录添加成功'
    }
  };
}

// 获取用户余额
async function getBalance(data, dbManager) {
  const { userPhone } = data;

  if (!userPhone) {
    throw new Error('用户手机号不能为空');
  }

  const memberCard = await dbManager.getMemberCard(userPhone);

  if (!memberCard) {
    throw new Error('用户会员信息不存在');
  }

  return {
    success: true,
    data: {
      balance: parseFloat(memberCard.balance),
      points: memberCard.points,
      level: memberCard.level,
      lastTransactionTime: memberCard.last_transaction_time
    }
  };
}

// 充值处理
async function recharge(data, dbManager) {
  const { userPhone, amount, paymentMethod = 'manual', description = '余额充值' } = data;

  if (!userPhone || !amount || amount <= 0) {
    throw new Error('用户手机号和有效充值金额不能为空');
  }

  // 获取当前余额
  const memberCard = await dbManager.getMemberCard(userPhone);
  const currentBalance = memberCard ? parseFloat(memberCard.balance) : 0;
  const newBalance = currentBalance + parseFloat(amount);

  // 创建交易记录
  const transactionId = await dbManager.addTransaction({
    user_phone: userPhone,
    type: 'recharge',
    amount: parseFloat(amount),
    balance_after: newBalance,
    description,
    reference_id: `recharge_${Date.now()}`,
    reference_type: paymentMethod,
    status: 'completed'
  });

  // 更新会员卡
  await dbManager.saveMemberCard(userPhone, {
    balance: newBalance,
    last_transaction_time: new Date()
  });

  // 充值积分奖励（每充值1元获得1积分）
  if (memberCard) {
    const newPoints = memberCard.points + Math.floor(parseFloat(amount));
    await dbManager.saveMemberCard(userPhone, {
      points: newPoints
    });
  }

  return {
    success: true,
    data: {
      transactionId,
      oldBalance: currentBalance,
      newBalance,
      pointsEarned: Math.floor(parseFloat(amount)),
      message: '充值成功'
    }
  };
}

// 处理付款
async function processPayment(data, dbManager) {
  const { userPhone, amount, referenceType, referenceId, description } = data;

  if (!userPhone || !amount || amount <= 0) {
    throw new Error('用户手机号和有效金额不能为空');
  }

  // 检查余额
  const memberCard = await dbManager.getMemberCard(userPhone);
  if (!memberCard) {
    throw new Error('用户会员信息不存在');
  }

  const currentBalance = parseFloat(memberCard.balance);
  if (currentBalance < parseFloat(amount)) {
    throw new Error('余额不足');
  }

  const newBalance = currentBalance - parseFloat(amount);

  // 创建交易记录
  const transactionId = await dbManager.addTransaction({
    user_phone: userPhone,
    type: 'payment',
    amount: parseFloat(amount),
    balance_after: newBalance,
    description: description || `${referenceType}支付`,
    reference_id: referenceId,
    reference_type: referenceType,
    status: 'completed'
  });

  // 更新会员卡余额
  await dbManager.saveMemberCard(userPhone, {
    balance: newBalance,
    last_transaction_time: new Date()
  });

  // 检查是否需要升级会员等级
  await checkAndUpdateMemberLevel(userPhone, dbManager);

  return {
    success: true,
    data: {
      transactionId,
      oldBalance: currentBalance,
      newBalance,
      message: '支付成功'
    }
  };
}

// 处理退款
async function refund(data, dbManager) {
  const { userPhone, amount, referenceId, referenceType, description } = data;

  if (!userPhone || !amount || amount <= 0) {
    throw new Error('用户手机号和有效退款金额不能为空');
  }

  // 获取当前余额
  const memberCard = await dbManager.getMemberCard(userPhone);
  if (!memberCard) {
    throw new Error('用户会员信息不存在');
  }

  const currentBalance = parseFloat(memberCard.balance);
  const newBalance = currentBalance + parseFloat(amount);

  // 创建交易记录
  const transactionId = await dbManager.addTransaction({
    user_phone: userPhone,
    type: 'refund',
    amount: parseFloat(amount),
    balance_after: newBalance,
    description: description || `${referenceType}退款`,
    reference_id: referenceId,
    reference_type: referenceType,
    status: 'completed'
  });

  // 更新会员卡余额
  await dbManager.saveMemberCard(userPhone, {
    balance: newBalance,
    last_transaction_time: new Date()
  });

  return {
    success: true,
    data: {
      transactionId,
      oldBalance: currentBalance,
      newBalance,
      message: '退款成功'
    }
  };
}

// 检查并更新会员等级
async function checkAndUpdateMemberLevel(userPhone, dbManager) {
  const memberCard = await dbManager.getMemberCard(userPhone);
  if (!memberCard) return;

  const totalTransactions = await dbManager.queryOne(
    'SELECT COUNT(*) as count, SUM(CASE WHEN type IN ("recharge", "bonus") THEN amount ELSE 0 END) as totalRecharge FROM transactions WHERE user_phone = ? AND status = "completed"',
    [userPhone]
  );

  const totalRecharge = parseFloat(totalTransactions.totalRecharge || 0);
  const transactionCount = totalTransactions.count || 0;

  let newLevel = 'bronze';
  if (totalRecharge >= 5000 || transactionCount >= 50) {
    newLevel = 'diamond';
  } else if (totalRecharge >= 2000 || transactionCount >= 20) {
    newLevel = 'gold';
  } else if (totalRecharge >= 500 || transactionCount >= 10) {
    newLevel = 'silver';
  }

  if (newLevel !== memberCard.level) {
    await dbManager.saveMemberCard(userPhone, {
      level: newLevel
    });

    // 如果升级，添加奖励积分
    const levelBonus = {
      'silver': 100,
      'gold': 300,
      'diamond': 500
    };

    if (levelBonus[newLevel]) {
      await dbManager.addTransaction({
        user_phone: userPhone,
        type: 'bonus',
        amount: levelBonus[newLevel],
        balance_after: parseFloat(memberCard.balance),
        description: `会员等级升级奖励 - ${newLevel}`,
        reference_id: `level_upgrade_${Date.now()}`,
        reference_type: 'level_bonus'
      });

      await dbManager.saveMemberCard(userPhone, {
        points: memberCard.points + levelBonus[newLevel]
      });
    }
  }
}
