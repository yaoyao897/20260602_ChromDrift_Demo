(function () {
  const SEED_MATERIALS = [
    { id: 'm1', materialCode: 'CP001', materialName: '成品A', spec: '500g', category: '成品', unit: '瓶', enabled: true },
    { id: 'm2', materialCode: 'RM001', materialName: '原料X', spec: 'AR', category: '原料', unit: 'kg', enabled: true },
    { id: 'm3', materialCode: 'RM002', materialName: '原料Y', spec: 'CP', category: '原料', unit: 'kg', enabled: true },
    { id: 'm4', materialCode: 'CP002', materialName: '成品B', spec: '1kg', category: '成品', unit: '袋', enabled: true },
    { id: 'm5', materialCode: 'RM003', materialName: '原料Z', spec: 'AR', category: '原料', unit: 'kg', enabled: true },
    { id: 'm6', materialCode: 'RM004', materialName: '原料W', spec: 'CP', category: '原料', unit: 'kg', enabled: true },
    { id: 'm7', materialCode: 'CP003', materialName: '成品C', spec: '250g', category: '成品', unit: '瓶', enabled: true },
  ];

  const SEED_QCP = [
    { id: 'q1', qcpCode: 'QCP01', qcpName: '反应步骤1', enabled: true, createdBy: '张三', createdAt: '2025-04-28 08:00:00' },
    { id: 'q2', qcpCode: 'QCP02', qcpName: '精制步骤', enabled: true, createdBy: '张三', createdAt: '2025-04-28 09:00:00' },
    { id: 'q3', qcpCode: 'QCP03', qcpName: '干燥步骤', enabled: true, createdBy: '李四', createdAt: '2025-04-28 10:00:00' },
    { id: 'q4', qcpCode: 'QCP04', qcpName: '灌装步骤', enabled: true, createdBy: '王五', createdAt: '2025-05-01 09:00:00' },
  ];

  window.ChromDriftSeedMasters = { SEED_MATERIALS, SEED_QCP };
})();
