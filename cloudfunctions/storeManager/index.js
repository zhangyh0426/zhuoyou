// 云函数：店铺管理
// cloudfunctions/storeManager/index.js

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
    case 'getStoreStatus':
      return await getStoreStatus(data, dbManager);
    case 'updateStoreStatus':
      return await updateStoreStatus(data, dbManager);
    case 'getStoreStatistics':
      return await getStoreStatistics(data, dbManager);
    case 'getAdminList':
      return await getAdminList(data, dbManager);
    case 'addAdmin':
      return await addAdmin(data, dbManager);
    case 'removeAdmin':
      return await removeAdmin(data, dbManager);
    case 'updateAdmin':
      return await updateAdmin(data, dbManager);
    default:
      throw new Error('未知操作');
    }
  } catch (error) {
    console.error('店铺管理云函数错误:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 获取店铺状态
async function getStoreStatus(data, dbManager) {
  const storeStatus = await dbManager.getStoreStatus();

  if (!storeStatus) {
    // 返回默认状态
    return {
      success: true,
      data: {
        isOpen: false,
        openTime: '',
        closeTime: '',
        lastUpdate: '',
        message: ''
      }
    };
  }

  return {
    success: true,
    data: {
      isOpen: storeStatus.is_open,
      openTime: storeStatus.open_time,
      closeTime: storeStatus.close_time,
      lastUpdate: storeStatus.last_update,
      message: storeStatus.message
    }
  };
}

// 更新店铺状态
async function updateStoreStatus(data, dbManager) {
  const { isOpen, openTime, closeTime, message, updatedBy } = data;

  if (!updatedBy) {
    throw new Error('操作人信息不能为空');
  }

  // 更新店铺状态
  const updatedStatus = await dbManager.updateStoreStatus({
    is_open: isOpen,
    open_time: openTime,
    close_time: closeTime,
    message: message || '',
    last_update: new Date()
  });

  // 记录操作日志（可以扩展为单独的日志表）
  console.log(`店铺状态由 ${updatedBy} 更新: ${JSON.stringify({
    isOpen,
    openTime,
    closeTime,
    message
  })}`);

  return {
    success: true,
    data: {
      message: '店铺状态更新成功',
      storeStatus: {
        isOpen: updatedStatus.is_open,
        openTime: updatedStatus.open_time,
        closeTime: updatedStatus.close_time,
        lastUpdate: updatedStatus.last_update,
        message: updatedStatus.message
      }
    }
  };
}

// 获取店铺统计数据
async function getStoreStatistics(data, dbManager) {
  const { startDate, endDate } = data;

  const dateFilter = startDate && endDate
    ? 'WHERE created_at >= ? AND created_at <= ?'
    : '';

  const dateParams = startDate && endDate ? [startDate, endDate] : [];

  // 用户统计
  const userStats = await dbManager.queryOne(`
    SELECT 
      COUNT(*) as totalUsers,
      COUNT(CASE WHEN last_login_time >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as activeUsers,
      COUNT(CASE WHEN register_time >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as newUsersThisWeek
    FROM users ${dateFilter}
  `, dateParams);

  // 活动统计
  const activityStats = await dbManager.queryOne(`
    SELECT 
      COUNT(*) as totalActivities,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completedActivities,
      COUNT(CASE WHEN status = 'open' THEN 1 END) as openActivities,
      AVG(current_players) as avgParticipants
    FROM activities ${dateFilter}
  `, dateParams);

  // 交易统计
  const transactionStats = await dbManager.queryOne(`
    SELECT 
      COUNT(*) as totalTransactions,
      SUM(CASE WHEN type = 'recharge' THEN amount ELSE 0 END) as totalRecharge,
      SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END) as totalPayment,
      AVG(CASE WHEN type = 'recharge' THEN amount END) as avgRechargeAmount
    FROM transactions ${dateFilter ? dateFilter.replace('users', 'transactions') : ''}
  `, dateParams);

  // 会员统计
  const memberStats = await dbManager.queryOne(`
    SELECT 
      COUNT(*) as totalMembers,
      SUM(balance) as totalBalance,
      AVG(balance) as avgBalance,
      COUNT(CASE WHEN level = 'diamond' THEN 1 END) as diamondMembers,
      COUNT(CASE WHEN level = 'gold' THEN 1 END) as goldMembers,
      COUNT(CASE WHEN level = 'silver' THEN 1 END) as silverMembers,
      COUNT(CASE WHEN level = 'bronze' THEN 1 END) as bronzeMembers
    FROM member_cards 
    WHERE status = 'active' ${dateFilter ? dateFilter.replace('users', 'mc.user_phone') : ''}
  `, dateParams);

  // 今日活动统计
  const todayActivities = await dbManager.queryOne(`
    SELECT 
      COUNT(*) as todayActivities,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as openToday,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgressToday
    FROM activities 
    WHERE DATE(date) = CURDATE()
  `);

  return {
    success: true,
    data: {
      users: {
        total: userStats.totalUsers || 0,
        active: userStats.activeUsers || 0,
        newThisWeek: userStats.newUsersThisWeek || 0
      },
      activities: {
        total: activityStats.totalActivities || 0,
        completed: activityStats.completedActivities || 0,
        open: activityStats.openActivities || 0,
        avgParticipants: parseFloat(activityStats.avgParticipants || 0).toFixed(1)
      },
      transactions: {
        total: transactionStats.totalTransactions || 0,
        totalRecharge: parseFloat(transactionStats.totalRecharge || 0).toFixed(2),
        totalPayment: parseFloat(transactionStats.totalPayment || 0).toFixed(2),
        avgRechargeAmount: parseFloat(transactionStats.avgRechargeAmount || 0).toFixed(2)
      },
      members: {
        total: memberStats.totalMembers || 0,
        totalBalance: parseFloat(memberStats.totalBalance || 0).toFixed(2),
        avgBalance: parseFloat(memberStats.avgBalance || 0).toFixed(2),
        diamond: memberStats.diamondMembers || 0,
        gold: memberStats.goldMembers || 0,
        silver: memberStats.silverMembers || 0,
        bronze: memberStats.bronzeMembers || 0
      },
      today: {
        activities: todayActivities.todayActivities || 0,
        open: todayActivities.openToday || 0,
        inProgress: todayActivities.inProgressToday || 0
      }
    }
  };
}

// 获取管理员列表
async function getAdminList(data, dbManager) {
  const admins = await dbManager.getAdmins();

  return {
    success: true,
    data: admins.map(admin => ({
      phone: admin.phone,
      name: admin.name,
      role: admin.role,
      permissions: admin.permissions || {},
      createdAt: admin.created_at
    }))
  };
}

// 添加管理员
async function addAdmin(data, dbManager) {
  const { phone, name, role = 'normal', permissions = {}, addedBy } = data;

  if (!phone || !name || !addedBy) {
    throw new Error('手机号、姓名和操作人不能为空');
  }

  // 检查用户是否存在
  const user = await dbManager.getUser(phone);
  if (!user) {
    throw new Error('用户不存在，请先让该用户注册');
  }

  // 检查是否已经是管理员
  const existingAdmin = await dbManager.queryOne(
    'SELECT * FROM admins WHERE phone = ?',
    [phone]
  );

  if (existingAdmin) {
    throw new Error('该用户已经是管理员');
  }

  // 添加管理员
  await dbManager.addAdmin({
    phone,
    name,
    role,
    permissions: JSON.stringify(permissions),
    created_by: addedBy
  });

  return {
    success: true,
    data: {
      message: '管理员添加成功'
    }
  };
}

// 删除管理员
async function removeAdmin(data, dbManager) {
  const { phone, removedBy } = data;

  if (!phone || !removedBy) {
    throw new Error('手机号和操作人不能为空');
  }

  // 检查管理员是否存在
  const existingAdmin = await dbManager.queryOne(
    'SELECT * FROM admins WHERE phone = ?',
    [phone]
  );

  if (!existingAdmin) {
    throw new Error('管理员不存在');
  }

  // 删除管理员
  await dbManager.delete('admins', 'phone = ?', [phone]);

  return {
    success: true,
    data: {
      message: '管理员删除成功'
    }
  };
}

// 更新管理员
async function updateAdmin(data, dbManager) {
  const { phone, updates, updatedBy } = data;

  if (!phone || !updatedBy) {
    throw new Error('手机号和操作人不能为空');
  }

  const updateData = {};
  if (updates.name) updateData.name = updates.name;
  if (updates.role) updateData.role = updates.role;
  if (updates.permissions) updateData.permissions = JSON.stringify(updates.permissions);

  if (Object.keys(updateData).length === 0) {
    throw new Error('没有提供要更新的信息');
  }

  await dbManager.update('admins', updateData, 'phone = ?', [phone]);

  return {
    success: true,
    data: {
      message: '管理员信息更新成功'
    }
  };
}
