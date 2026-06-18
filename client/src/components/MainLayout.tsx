import { Layout, Menu, theme } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  FileTextOutlined,
  SearchOutlined,
  TeamOutlined,
  ShareAltOutlined,
  PaperClipOutlined,
  FilterOutlined,
  HistoryOutlined,
  ClusterOutlined,
  SolutionOutlined,
  WarningOutlined,
  SwapOutlined,
  CoffeeOutlined,
  SafetyCertificateOutlined,
  BellOutlined,
  ScanOutlined,
} from '@ant-design/icons';

const { Header, Sider } = Layout;

const menuItems = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '工作台',
  },
  {
    key: '/analysis',
    icon: <ClusterOutlined />,
    label: '跨案串并分析',
  },
  {
    key: '/cases',
    icon: <FileTextOutlined />,
    label: '案件台账',
  },
  {
    key: '/clues',
    icon: <SearchOutlined />,
    label: '线索录入',
  },
  {
    key: '/clue-check-flows',
    icon: <SolutionOutlined />,
    label: '线索核查闭环',
  },
  {
    key: '/case-meetings',
    icon: <CoffeeOutlined />,
    label: '案件会商纪要',
  },
  {
    key: '/persons',
    icon: <TeamOutlined />,
    label: '人员管理',
  },
  {
    key: '/relations',
    icon: <ShareAltOutlined />,
    label: '人员关系图',
  },
  {
    key: '/risk-profiles',
    icon: <WarningOutlined />,
    label: '风险画像',
  },
  {
    key: '/surveillance-rules',
    icon: <SafetyCertificateOutlined />,
    label: '布控预警规则',
  },
  {
    key: '/alerts',
    icon: <BellOutlined />,
    label: '预警消息处置',
  },
  {
    key: '/evidences',
    icon: <PaperClipOutlined />,
    label: '证据附件',
  },
  {
    key: '/evidence-transfers',
    icon: <SwapOutlined />,
    label: '证据流转与保全',
  },
  {
    key: '/forensics',
    icon: <ScanOutlined />,
    label: '电子数据取证',
    children: [
      {
        key: '/forensics',
        label: '取证文件管理',
      },
      {
        key: '/forensics/import',
        label: '批量导入',
      },
    ],
  },
  {
    key: '/search',
    icon: <FilterOutlined />,
    label: '查询筛选',
  },
  {
    key: '/operation-logs',
    icon: <HistoryOutlined />,
    label: '操作日志',
  },
];

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const findSelectedKey = (items: any[], pathname: string): string | undefined => {
    for (const item of items) {
      if (item.children) {
        const childKey = findSelectedKey(item.children, pathname);
        if (childKey) return childKey;
      }
      if (pathname.startsWith(item.key)) {
        return item.key;
      }
    }
    return undefined;
  };

  const findOpenKey = (items: any[], pathname: string): string | undefined => {
    for (const item of items) {
      if (item.children) {
        if (pathname.startsWith(item.key)) {
          return item.key;
        }
        const childKey = findOpenKey(item.children, pathname);
        if (childKey) return item.key;
      }
    }
    return undefined;
  };

  const selectedKey = findSelectedKey(menuItems, location.pathname) || '/dashboard';
  const openKey = findOpenKey(menuItems, location.pathname);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'linear-gradient(90deg, #1a1a2e 0%, #16213e 100%)',
          padding: '0 24px',
        }}
      >
        <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
          }}>
            🔍
          </div>
          刑侦案件线索管理平台
        </div>
      </Header>
      <Layout>
        <Sider
          width={220}
          style={{
            background: colorBgContainer,
            borderRight: '1px solid #f0f0f0',
          }}
        >
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            defaultOpenKeys={openKey ? [openKey] : []}
            items={menuItems}
            onClick={({ key }) => navigate(key as string)}
            style={{ height: '100%', borderRight: 0, paddingTop: '16px' }}
          />
        </Sider>
        <Layout style={{ padding: '0', background: '#f0f2f5' }}>
          {children}
        </Layout>
      </Layout>
    </Layout>
  );
}
