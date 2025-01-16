// 导入electron的ipcRenderer模块
const { ipcRenderer } = require('electron')

// 从localStorage中获取'codes'和'names'的数据
let codes = getStorageData('codes')
let names = getStorageData('names')

// 初始化界面边界
initBounds();

// 如果codes和names数组都非空，则获取股票数据
if(codes.length > 0 && names.length > 0){
    getStockData(true, codes.join(','));
}

// 从localStorage中获取数据
function getStorageData(key){
    let data = localStorage.getItem(key);
    console.log(data)
    if(data  == null || data == ''){
        return []
    }else{
        return data.split(',')
    }
}

// 存储当前值等于MA20的股票信息
let alertedStocks = new Set(); // 使用Set来存储已提醒的股票
let alertMessages = []; // 存储待提醒的股票信息

// 更新股票数据
function updateStockData(stock) {
    let symbol = stock['symbol'];
    let tdCurrent = document.getElementById(symbol + 'current');
    let tdPercent = document.getElementById(symbol + 'percent');
    let tdMA20 = document.getElementById(symbol + 'ma20'); // 获取MA20单元格

    tdCurrent.innerHTML = stock['current'];
    tdPercent.innerHTML = stock['percent'] + '%';
    
    // 直接将MA20的值更新到tdMA20
    if (tdMA20) {
        tdMA20.innerHTML = tdMA20.innerHTML; // 这里可以根据需要更新MA20的值
        
        // 检查tdCurrent是否等于tdMA20，并记录符合条件的股票
        if (tdCurrent.innerHTML === tdMA20.innerHTML && !alertedStocks.has(symbol)) {
            let stockName = names[codes.indexOf(symbol)]; // 获取股票名称
            alertMessages.push(`${stockName} 的当前值与MA20值相等！`);
            alertedStocks.add(symbol); // 标记为已提醒
        }
    }
}

// 在每次更新后检查并展示弹窗
function checkAndShowAlerts() {
    if (alertMessages.length > 0) {
        alert(alertMessages.join('\n'));
        alertMessages = []; // 清空数组
    }
}

// 每次获取股票数据后调用checkAndShowAlerts
setInterval(() => {
    if (codes.length > 0) {
        getStockData(false, codes.join(','));
        checkAndShowAlerts(); // 检查并展示弹窗
    }
}, 3000);

// 获取股票数据
function getStockData(needCreate, symbols) {
    fetch('https://stock.xueqiu.com/v5/stock/realtime/quotec.json?symbol=' + symbols)
        .then((response) => {
            response.json().then((json) => {
                let length = json.data.length;
                for (let i = 0; i < length; i++) {
                    const stock = json.data[i];
                    if (needCreate) {
                        createStockTr(stock)
                    }
                    updateStockData(stock)
                    // 计算并更新MA20值
                    calculateAndUpdateMA20(stock.symbol);
                }
            })
        })
}

function getCloseValues(symbol, scale, ma, datalen) {
    const url = `https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=${symbol}&scale=${scale}&ma=${ma}&datalen=${datalen}`;

    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('请求失败');
            }
            return response.json();
        })
        .then(klineData => {
            return klineData.map(item => parseFloat(item.close));
        })
        .catch(error => {
            console.error('请求失败:', error);
            return [];
        });
}

function calculateMA20(closeValues) {
    if (closeValues.length < 20) {
        console.log("数据不足以计算 MA20");
        return null;
    }

    const ma20 = closeValues.reduce((sum, value) => sum + value, 0) / closeValues.length;
    return Math.round(ma20 * 100) / 100;
}

// 计算并更新MA20值
function calculateAndUpdateMA20(symbol) {
    const scale = 30;
    const ma = "no";
    const datalen = 20;

    getCloseValues(symbol, scale, ma, datalen)
        .then(closeValues => {
            if (closeValues.length > 0) {
                console.log("收盘价格列表:", closeValues);
                const ma20 = calculateMA20(closeValues);
                if (ma20 !== null) {
                    console.log("MA20 值:", ma20);
                    // 更新表格中的MA20值
                    updateMA20InTable(symbol, ma20);
                }
            }
        });
}

// 获取输入框元素
let input = document.getElementById('input');
let inputVisible = false;

// 监听输入框的键盘事件
input.addEventListener('keydown', (e) => {
    if (e.key == "Enter") {
        let value = e.target.value;
        let keys = value.split(' ');
        if (keys[0] == 'add' && keys.length > 2) {
            // 批量添加股票
            for (let i = 1; i < keys.length; i += 2) {
                if (keys[i + 1]) { // 确保有对应的代码
                    names.push(keys[i]);
                    codes.push(keys[i + 1]);
                    getStockData(true, keys[i + 1]);
                }
            }
        } else if (keys[0] == 'remove' && keys.length > 1) {
            let index = names.indexOf(keys[1]);
            names.splice(index, 1);
            codes.splice(index, 1);
            let table = document.getElementById('table');
            table.removeChild(table.childNodes[index + 2]);
            getStockData(false, codes.join(','));
        } else if (keys[0] == 'clear') {
            names = [];
            codes = [];
            let table = document.getElementById('table');
            let length = table.childNodes.length;
            for (let i = 2; i < length; i++) {
                table.removeChild(table.childNodes[2]);
            }
            getStockData(false, codes.join(','));
        }

        localStorage.setItem('codes', codes.join(','));
        localStorage.setItem('names', names.join(','));
        e.target.value = '';
    }
})

// 创建股票行
function createStockTr(stock) {
    let symbol = stock['symbol'];
    let index = codes.indexOf(symbol);
    let stockName = names[index];
    let tr = document.createElement('tr');
    let tdSymbol = document.createElement('td');
    let tdCurrent = document.createElement('td');
    let tdPercent = document.createElement('td');
    let tdMA20 = document.createElement('td'); // 直接使用MA20单元格

    tdSymbol.innerHTML = stockName;
    tdCurrent.setAttribute('id', symbol + 'current');
    tdPercent.setAttribute('id', symbol + 'percent');
    tdMA20.setAttribute('id', symbol + 'ma20'); // 设置ID

    tdMA20.setAttribute('class', 'tdEnd'); // 设置样式类为tdEnd
    tdSymbol.setAttribute('class', 'tdStart');
    tdCurrent.setAttribute('class', 'tdCenter');
    tdPercent.setAttribute('class', 'tdCenter');

    tr.appendChild(tdSymbol);
    tr.appendChild(tdPercent);
    tr.appendChild(tdCurrent);
    tr.appendChild(tdMA20); // 将MA20单元格添加到表格行中

    document.getElementById('table').appendChild(tr);
}

// 新增函数：更新表格中的MA20值
function updateMA20InTable(symbol, ma20) {
    let tdMA20 = document.getElementById(symbol + 'ma20');
    if (!tdMA20) {
        // 如果单元格不存在，则找到对应的行并创建一个新的单元格
        let row = document.querySelector(`#table tr td[id^="${symbol}"]`).parentNode; // 找到对应symbol的行
        tdMA20 = document.createElement('td');
        tdMA20.setAttribute('id', symbol + 'ma20');
        row.appendChild(tdMA20); // 将MA20单元格添加到对应行
    }
    // 更新MA20值
    tdMA20.innerHTML = ma20;
}

// 初始化界面边界
function initBounds(){
    let width =localStorage.getItem('width')
    let height =localStorage.getItem('height')
    if(width == null || width == ''){
        width = 300;
    }else
        width = Number.parseInt(width)
    if(height == null || height == ''){
        height = 360;
    }else
        height = Number.parseInt(height )
    
    ipcRenderer.send('content-bounds', {
        width:width,
        height:height,
    })

    ipcRenderer.on('save-content-bounds', (event, arg) => {
        console.log(arg) 
        localStorage.setItem('width',arg.width)
        localStorage.setItem('height',arg.height)
    })
}

// 监听全局键盘事件，用于切换输入框的显示隐藏
window.addEventListener('keyup', (event)=>{
    if(event.key == 'Alt'){
        console.log('输入命令')
        input.style.visibility = inputVisible  ? 'hidden':'visible'
        inputVisible = !inputVisible;
    }
}, true)