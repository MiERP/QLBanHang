export type ImportKind =
  | 'categories'
  | 'customer-groups'
  | 'warehouses'
  | 'org-units'
  | 'staff'
  | 'products'
  | 'customers'
  | 'opening-stock'
  | 'orders';

export const IMPORT_KINDS: ImportKind[] = [
  'categories',
  'customer-groups',
  'warehouses',
  'org-units',
  'staff',
  'products',
  'customers',
  'opening-stock',
  'orders',
];

export const isImportKind = (value: string): value is ImportKind => (IMPORT_KINDS as string[]).includes(value);

export type ColumnType = 'text' | 'number' | 'date' | 'bool' | 'enum' | 'ref';

export interface EnumOption {
  value: string;
  label: string;
}

export interface ImportColumn {
  key: string;
  header: string;
  aliases?: string[];
  required?: boolean;
  type: ColumnType;
  enumValues?: EnumOption[];
  hint?: string;
  sample?: string;
}

export interface ImportSpec {
  kind: ImportKind;
  title: string;
  fileName: string;
  columns: ImportColumn[];
  notes: string[];
}

const ORDER_NOTE =
  'Các dòng cùng "Mã nhóm đơn" được gộp thành 1 đơn hàng. Nếu để trống cột này, hệ thống gộp theo (Khách hàng + Ngày đơn + Kho xuất + Loại đơn).';

export const IMPORT_SPECS: Record<ImportKind, ImportSpec> = {
  categories: {
    kind: 'categories',
    title: 'Nhóm hàng hóa',
    fileName: 'Mau nhap nhom hang hoa.xlsx',
    columns: [
      { key: 'code', header: 'Mã nhóm', required: true, type: 'text', sample: 'NH001' },
      { key: 'name', header: 'Tên nhóm', required: true, type: 'text', sample: 'Nước đóng bình 19L' },
      {
        key: 'type',
        header: 'Loại nhóm',
        required: true,
        type: 'enum',
        enumValues: [
          { value: 'BOTTLE_WATER', label: 'Nước đóng bình 19L' },
          { value: 'PACK_WATER', label: 'Nước đóng chai nhỏ' },
          { value: 'SERVICE_DVGT', label: 'Dịch vụ gia tăng' },
        ],
      },
    ],
    notes: [
      'Mã nhóm phải là duy nhất, không trùng với nhóm đang có trong hệ thống.',
      'Loại nhóm quyết định cách tính vỏ bình và giá của sản phẩm thuộc nhóm đó.',
    ],
  },

  'customer-groups': {
    kind: 'customer-groups',
    title: 'Nhóm khách hàng',
    fileName: 'Mau nhap nhom khach hang.xlsx',
    columns: [
      { key: 'code', header: 'Mã nhóm', required: true, type: 'text', sample: 'NKH01' },
      { key: 'name', header: 'Tên nhóm', required: true, type: 'text', sample: 'Khách hàng bán buôn' },
    ],
    notes: ['Mã nhóm phải là duy nhất.', 'Nhóm khách hàng dùng để phân loại và áp bảng giá riêng.'],
  },

  warehouses: {
    kind: 'warehouses',
    title: 'Kho hàng',
    fileName: 'Mau nhap kho hang.xlsx',
    columns: [
      { key: 'code', header: 'Mã kho', type: 'text', hint: 'Để trống hệ thống tự sinh (KHO-001...)', sample: 'KHO-001' },
      { key: 'name', header: 'Tên kho', required: true, type: 'text', sample: 'Kho trung tâm' },
      {
        key: 'type',
        header: 'Loại kho',
        required: true,
        type: 'enum',
        enumValues: [
          { value: 'CENTRAL', label: 'Kho trung tâm' },
          { value: 'STORE', label: 'Kho cửa hàng' },
          { value: 'VEHICLE', label: 'Kho lưu động (xe)' },
          { value: 'STATION', label: 'Kho trạm' },
          { value: 'CUSTOMER', label: 'Khách hàng' },
          { value: 'VIRTUAL', label: 'Kho ảo (trung gian)' },
        ],
      },
      {
        key: 'manager',
        header: 'Thủ kho',
        type: 'ref',
        hint: 'Ghi mã nhân viên hoặc họ tên — nhân viên phải được nhập trước',
        sample: 'NV001',
      },
      { key: 'location', header: 'Vị trí', type: 'text', sample: 'Số 12 đường Lê Lợi, Huế' },
      { key: 'inactive', header: 'Ngừng dùng', type: 'bool', hint: 'Ghi x nếu kho không còn hoạt động' },
    ],
    notes: [
      'Nên nhập kho trước khi nhập tồn kho đầu kỳ và đơn hàng.',
      'Hệ thống đã có sẵn các kho hệ thống (kho mượn, kho khách hàng, kho trung chuyển) — không cần nhập lại.',
    ],
  },

  'org-units': {
    kind: 'org-units',
    title: 'Đơn vị (tổ chức)',
    fileName: 'Mau nhap don vi.xlsx',
    columns: [
      { key: 'code', header: 'Mã đơn vị', type: 'text', hint: 'Để trống hệ thống tự sinh (DV-001...)', sample: 'DV-001' },
      { key: 'name', header: 'Tên đơn vị', required: true, type: 'text', sample: 'Xí nghiệp nước Hương Thủy' },
      {
        key: 'parent',
        header: 'Thuộc đơn vị',
        type: 'ref',
        hint: 'Ghi mã hoặc tên đơn vị cấp trên, để trống nếu là cấp cao nhất',
        sample: 'DV-002',
      },
      { key: 'unit_type', header: 'Loại đơn vị', type: 'text', hint: 'VD: Xí nghiệp, Trạm, Tổ', sample: 'Xí nghiệp' },
      {
        key: 'manager',
        header: 'Trưởng đơn vị',
        type: 'ref',
        hint: 'Ghi mã nhân viên hoặc họ tên — nhân viên phải được nhập trước',
        sample: 'NV001',
      },
      { key: 'sort_order', header: 'Thứ tự', type: 'number', hint: 'Số nhỏ hiển thị trước' },
    ],
    notes: [
      'Đơn vị cấp trên phải xuất hiện trước hoặc ở dòng phía trên trong cùng tệp.',
      'Trưởng đơn vị nên nhập sau khi đã có nhân viên.',
    ],
  },

  staff: {
    kind: 'staff',
    title: 'Nhân viên',
    fileName: 'Mau nhap nhan vien.xlsx',
    columns: [
      { key: 'code', header: 'Mã nhân viên', type: 'text', hint: 'Để trống hệ thống tự sinh (NV001...)', sample: 'NV001' },
      { key: 'full_name', header: 'Họ tên', required: true, type: 'text', sample: 'Trần Nam Trung' },
      { key: 'org_unit', header: 'Đơn vị', type: 'ref', hint: 'Ghi mã hoặc tên đơn vị', sample: 'DV-001' },
      { key: 'position', header: 'Chức vụ', type: 'ref', hint: 'Ghi mã hoặc tên chức vụ', sample: 'Giám đốc' },
      { key: 'phone', header: 'Điện thoại', type: 'text', sample: '0912.888.999' },
      { key: 'home_address', header: 'Địa chỉ', type: 'text' },
      { key: 'date_of_birth', header: 'Ngày sinh', type: 'date', sample: '15/08/1985' },
      { key: 'gender', header: 'Giới tính', type: 'text', sample: 'Nam' },
      { key: 'id_number', header: 'Số CCCD/CMND', type: 'text' },
      { key: 'join_date', header: 'Ngày vào làm', type: 'date', sample: '01/03/2020' },
      { key: 'education', header: 'Trình độ', type: 'text', sample: 'Đại học' },
      { key: 'commission_rate', header: 'Tỷ lệ hoa hồng', type: 'number', hint: 'Số thập phân, VD 0.05 = 5%' },
      { key: 'shipping_allowance', header: 'Phụ cấp giao hàng', type: 'number', hint: 'Mặc định 5.000đ' },
      { key: 'inactive', header: 'Ngừng làm việc', type: 'bool', hint: 'Ghi x nếu đã nghỉ' },
    ],
    notes: [
      'Ngày tháng ghi theo dạng DD/MM/YYYY (VD 15/08/1985) hoặc dạng ngày chuẩn của Excel.',
      'Đơn vị và chức vụ nên nhập trước; nhân viên chưa có đơn vị vẫn nhập được.',
    ],
  },

  products: {
    kind: 'products',
    title: 'Sản phẩm',
    fileName: 'Mau nhap san pham.xlsx',
    columns: [
      { key: 'code', header: 'Mã sản phẩm', type: 'text', hint: 'Để trống hệ thống tự sinh (SP0001...)', sample: 'SP0001' },
      { key: 'name', header: 'Tên sản phẩm', required: true, type: 'text', sample: 'Nước tinh khiết bình 19L' },
      { key: 'category', header: 'Nhóm hàng', type: 'ref', hint: 'Ghi mã hoặc tên nhóm hàng', sample: 'Nước đóng bình 19L' },
      { key: 'unit', header: 'Đơn vị tính', type: 'text', hint: 'VD: Bình, Vỉ, Chai, Thùng', sample: 'Bình' },
      {
        key: 'product_type',
        header: 'Loại',
        type: 'enum',
        enumValues: [
          { value: 'GOODS', label: 'Hàng hóa' },
          { value: 'SERVICE', label: 'Dịch vụ' },
        ],
      },
      {
        key: 'bottle_type',
        header: 'Loại bình',
        type: 'enum',
        enumValues: [
          { value: 'VOI', label: 'Bình vòi' },
          { value: 'UP', label: 'Bình úp' },
          { value: 'NONE', label: 'Không có vỏ' },
        ],
      },
      { key: 'standard_price', header: 'Giá bán', required: true, type: 'number', sample: '50000' },
      {
        key: 'cost_price',
        header: 'Giá trước thuế',
        aliases: ['Giá vốn'],
        type: 'number',
        hint: 'Để trống hệ thống tự tính theo thuế suất VAT',
      },
      { key: 'deposit_fee', header: 'Cọc vỏ', type: 'number', hint: 'Chỉ dùng cho bình có vỏ' },
      { key: 'barcode', header: 'Mã vạch', type: 'text' },
      { key: 'inactive', header: 'Ngừng bán', type: 'bool', hint: 'Ghi x nếu ngừng kinh doanh' },
    ],
    notes: [
      'Sản phẩm là dịch vụ sẽ không có tồn kho và không lên được đơn hàng.',
      'Loại bình chỉ áp dụng cho bình nước (nhóm Nước đóng bình 19L, đơn vị Bình).',
      'Số lượng tồn đầu kỳ nhập ở tệp riêng "Tồn kho đầu kỳ", không nhập trong tệp này.',
    ],
  },

  customers: {
    kind: 'customers',
    title: 'Khách hàng',
    fileName: 'Mau nhap khach hang.xlsx',
    columns: [
      { key: 'code', header: 'Mã khách hàng', type: 'text', hint: 'Để trống hệ thống tự sinh (KH001...)', sample: 'KH001' },
      { key: 'name', header: 'Tên khách hàng', required: true, type: 'text', sample: 'Công ty TNHH Thương mại Bình An' },
      { key: 'group', header: 'Nhóm khách hàng', type: 'ref', hint: 'Ghi mã hoặc tên nhóm khách hàng', sample: 'Khách hàng bán buôn' },
      { key: 'phone', header: 'Điện thoại', type: 'text', sample: '0905.123.456' },
      { key: 'address', header: 'Địa chỉ', required: true, type: 'text', sample: '45 Nguyễn Huệ, TP Huế' },
      { key: 'tax_code', header: 'Mã số thuế', type: 'text' },
      { key: 'contact_person', header: 'Người liên hệ', type: 'text' },
      { key: 'personal_id', header: 'Số CCCD/CMND', type: 'text' },
      { key: 'budget_relation_code', header: 'Mã quan hệ ngân sách', type: 'text' },
      { key: 'max_debt_limit', header: 'Hạn mức nợ', type: 'number', hint: 'Để trống = 10.000.000đ' },
      { key: 'current_debt', header: 'Nợ đầu kỳ', type: 'number', hint: 'Số tiền khách đang nợ khi bắt đầu dùng phần mềm' },
      { key: 'bottle_debt_voi', header: 'Nợ vỏ bình vòi', type: 'number' },
      { key: 'bottle_debt_up', header: 'Nợ vỏ bình úp', type: 'number' },
      { key: 'inactive', header: 'Ngừng giao dịch', type: 'bool' },
    ],
    notes: [
      'Nợ đầu kỳ và nợ vỏ là số dư khi bắt đầu sử dụng phần mềm, không phải phát sinh trong kỳ.',
      'Khách hàng phải được nhập trước khi nhập đơn hàng.',
    ],
  },

  'opening-stock': {
    kind: 'opening-stock',
    title: 'Tồn kho đầu kỳ',
    fileName: 'Mau nhap ton kho dau ky.xlsx',
    columns: [
      { key: 'warehouse', header: 'Kho', required: true, type: 'ref', hint: 'Ghi mã hoặc tên kho', sample: 'Kho trung tâm' },
      { key: 'product', header: 'Mã sản phẩm', required: true, type: 'ref', hint: 'Ghi mã hoặc tên sản phẩm', sample: 'SP0001' },
      { key: 'quantity', header: 'Số lượng tồn', required: true, type: 'number', sample: '120' },
      { key: 'min_stock_alert', header: 'Tồn tối thiểu', type: 'number', hint: 'Ngưỡng cảnh báo sắp hết hàng' },
      { key: 'date', header: 'Ngày', type: 'date', hint: 'Để trống = ngày hôm nay', sample: '01/09/2026' },
    ],
    notes: [
      'Số lượng trong tệp là số tồn THỰC TẾ — hệ thống tự tạo phiếu điều chỉnh tăng/giảm để khớp đúng con số này.',
      'Mặt hàng không có trong tệp sẽ giữ nguyên tồn kho hiện tại.',
      'Nhập lại cùng một tệp nhiều lần sẽ không làm sai số liệu (kết quả luôn bằng đúng số trong tệp).',
      'Phải nhập sản phẩm và kho trước.',
    ],
  },

  orders: {
    kind: 'orders',
    title: 'Đơn hàng',
    fileName: 'Mau nhap don hang.xlsx',
    columns: [
      { key: 'order_group', header: 'Mã nhóm đơn', type: 'text', hint: 'Dòng cùng mã = 1 đơn hàng', sample: 'DH001' },
      { key: 'order_date', header: 'Ngày đơn', required: true, type: 'date', sample: '15/09/2026' },
      { key: 'customer', header: 'Khách hàng', required: true, type: 'ref', hint: 'Ghi mã hoặc tên khách hàng', sample: 'KH001' },
      {
        key: 'order_type',
        header: 'Loại đơn',
        type: 'enum',
        enumValues: [
          { value: 'SALE', label: 'Bán hàng' },
          { value: 'LEND_OUT', label: 'Cho mượn' },
          { value: 'BORROW_IN', label: 'Mượn vào' },
          { value: 'HIRED_LOAD', label: 'Bốc xếp thuê' },
        ],
      },
      { key: 'warehouse', header: 'Kho xuất', type: 'ref', hint: 'Bắt buộc với đơn bán hàng / cho mượn', sample: 'Kho trung tâm' },
      { key: 'partner_unit', header: 'Đối tác liên kết', type: 'ref', hint: 'Bắt buộc với đơn cho mượn / mượn vào / bốc xếp' },
      { key: 'seller', header: 'Nhân viên bán', type: 'ref', sample: 'NV001' },
      { key: 'shipper', header: 'Nhân viên giao', type: 'ref', hint: 'Nhiều người giao thì ghi cách nhau dấu + (VD: Huế + Phương) — phí vận chuyển chia đều' },
      { key: 'product', header: 'Mã sản phẩm', required: true, type: 'ref', hint: 'Ghi mã hoặc tên sản phẩm', sample: 'SP0001' },
      { key: 'quantity', header: 'Số lượng', required: true, type: 'number', sample: '10' },
      { key: 'quantity_promo', header: 'SL khuyến mãi', type: 'number', hint: 'Số lượng tặng kèm' },
      { key: 'unit_price', header: 'Đơn giá', type: 'number', hint: 'Để trống = giá bán của sản phẩm' },
      {
        key: 'status',
        header: 'Trạng thái',
        type: 'enum',
        enumValues: [
          { value: 'DRAFT', label: 'Nháp' },
          { value: 'CONFIRMED', label: 'Đã xác nhận' },
          { value: 'SHIPPING', label: 'Đang giao' },
          { value: 'COMPLETED', label: 'Hoàn tất' },
        ],
      },
      {
        key: 'payment_status',
        header: 'Trạng thái thanh toán',
        type: 'enum',
        enumValues: [
          { value: 'UNPAID', label: 'Chưa thanh toán' },
          { value: 'PARTIAL', label: 'Thanh toán một phần' },
          { value: 'PAID', label: 'Đã thanh toán' },
        ],
      },
      { key: 'paid_amount', header: 'Số tiền đã trả', type: 'number', hint: 'Chỉ dùng khi thanh toán một phần' },
      { key: 'shipping_fee', header: 'Phí vận chuyển', type: 'number', hint: 'Lấy theo dòng đầu của nhóm' },
      {
        key: 'shipping_fee_id',
        header: 'Tuyến phí vận chuyển',
        type: 'ref',
        hint: 'Bắt buộc khi trạng thái khác "Nháp" — ghi mã hoặc tên tuyến phí',
        sample: 'VC-001',
      },
      {
        key: 'payment_method',
        header: 'Hình thức thanh toán',
        type: 'enum',
        enumValues: [
          { value: 'CASH', label: 'Tiền mặt' },
          { value: 'BANK_TRANSFER', label: 'Chuyển khoản' },
          { value: 'DEBT', label: 'Công nợ' },
        ],
      },
      { key: 'delivery_date', header: 'Ngày giao', type: 'date' },
      { key: 'note', header: 'Ghi chú', type: 'text' },
    ],
    notes: [
      ORDER_NOTE,
      'Thông tin cấp đơn (trạng thái, thanh toán, phí vận chuyển, ngày giao, ghi chú) lấy theo dòng đầu tiên của nhóm.',
      'Trạng thái "Nháp" chỉ tạo đơn, chưa tác động kho. Các trạng thái còn lại sẽ trừ tồn kho và ghi nhận doanh thu — hãy nhập tồn kho đầu kỳ trước.',
      'Đơn ở trạng thái khác "Nháp" cần có "Nhân viên bán" (trừ đơn cho mượn), "Tuyến phí vận chuyển" và kho xuất.',
      'Phải nhập khách hàng, kho và sản phẩm trước.',
    ],
  },
};
