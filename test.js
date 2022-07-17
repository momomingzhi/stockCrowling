const axios = require("axios");
const cheerio = require("cheerio");
var iconv = require('iconv-lite');

const setInvesterType = (string) =>{
    let res = "";
    const profit = {
        "+" : '순매수 전환',
        "-" : '순매도 전환'
    }
    if(string.includes('+')){
        let data = string.split('+');
        res = data[0] + data[1] + profit["+"];
    }else if(string.includes('-')){
        let data = string.split('-');
        res = data[0] + data[1] + profit["-"];
    }
    return res;
}
const getGlobalIndex= async (resObj) =>{
    let exchangeUrl = 'https://finance.naver.com/';
    const goldUrl = 'https://finance.naver.com/marketindex/worldGoldDetail.naver?marketindexCd=CMDT_GC&fdtc=2';
    try{
        const {data} =  await axios({
            url:exchangeUrl,
            method:'GET',
            responseType : "arraybuffer"
        })
        const currencySign = {
            0:'윈/달러',
            1:'원/엔화'
        }
        const content = iconv.decode(data,"EUC-KR").toString();
        const $ = cheerio.load(content);
        const exchangeValue = $('.h_exchange+.tbl_home tbody tr');
        exchangeValue.each((i,tag)=>{
            const currency = $(tag).find('td').text().split(' ');
            const signal = currency[0].split('').slice(-2).join('').trim() === '상승' ? '+' : '-';
            const newCurrency = `${currency[0]}(${signal}${currency[1]})`
            if(currencySign[i])
                resObj[currencySign[i]] = newCurrency;

        })

    }catch (error) {
        console.error(error);
    }
    try{
        const {data} =  await axios({
            url:goldUrl,
            method:'GET',
            responseType : "arraybuffer"
        })
        const content = iconv.decode(data,"EUC-KR").toString();
        const $ = cheerio.load(content);
        const goldValue = $('.th_metal_gold~td').text().split(' ');
        const signal = $('.aside div tbody ').find('tr').attr('class') === 'down' ? '-' : '+';
        const newGoldValue = `${goldValue[0]}원/g(${signal}${goldValue[2]})원`
        resObj['금'] = newGoldValue;
    }catch (error) {
        console.error(error);
    }
    return resObj;
}
const getIndexHTML =  async(type,resObj) =>{
    let url = '';
    let startUrl = '';
    const investorType = {
        0: '개인',
        1: '외국인',
        2:'기관',
        5:'프로그램'
    }
    if(type === 'KOSPI'){
        url = "https://finance.naver.com/sise/sise_index.naver?code=KOSPI";
        startUrl = 'https://kr.investing.com/indices/kospi';
    }
    else{
        url = 'https://finance.naver.com/sise/sise_index.naver?code=KOSDAQ';
        startUrl = 'https://kr.investing.com/indices/kosdaq';
    }
    try{
        const {data} =  await axios({
            url:startUrl,
            method:'GET',
            responseType : "arraybuffer"
        })
        const content = iconv.decode(data,"EUC-KR").toString();
        const $ = cheerio.load(content);
        const startValue = $('div[data-test=open-value]').text();
        resObj['시가'] = startValue;
    }catch (error) {
        console.error(error);
    }
    try {
        const {data} =  await axios({
            url:url,
            method:'GET',
            responseType : "arraybuffer"
        })
        const content = iconv.decode(data,"EUC-KR").toString();
        const $ = cheerio.load(content);

        const index = $('.subtop_sise_detail');
        index.each((i,tag)=>{
            const lastValue = $(tag).find('#now_value').text();
            const highValue = $(tag).find('#high_value').text();
            const lowValue = $(tag).find('#low_value').text();
            const ratio = $(tag).find('#change_value_and_rate').text().replace('상승','');

            resObj['종가'] = lastValue;
            resObj['고가'] = highValue;
            resObj['저가'] = lowValue;
            resObj['퍼센트'] = ratio;

        })

        const list = $('.lst_kos_info dd');
        await list.each(async(i,tag)=> {
            if(investorType[i])
                resObj[investorType[i]] = setInvesterType($(tag).text());
        })
    } catch (error) {
        console.error(error);
    }

    return resObj;
}
function getFormatDate(date){
    const year = date.getFullYear();              //yyyy
    let month = (1 + date.getMonth());          //M
    month = month >= 10 ? month : '0' + month;  //month 두자리로 저장
    let day = date.getDate();                   //d
    day = day >= 10 ? day : '0' + day;          //day 두자리로 저장
    return  year + '-' + month + '-' + day;       //'-' 추가하여 yyyy-mm-dd 형태 생성 가능
}
const printValue = (title,obj) =>{
    console.log('■',title)
    for(let v in obj){
        console.log(v,' ',obj[v])
        v === '퍼센트' && console.log('▶투자자별 매매동향')
    }
}
const kospiInfo = async () =>{
    const kospiObj = {};
    const kosdacObj = {};
    const globalIndexObj = {};
    const title = `[${getFormatDate(new Date)} 주가지수 및 투자자별 매매동향]`
    const res = await getIndexHTML('KOSPI',kospiObj)
    const dacRes = await getIndexHTML('KOSDAC',kosdacObj)
    const globalIndex = await getGlobalIndex(globalIndexObj)
    console.log('title:',title)
    printValue('코스피',res)
    console.log('\n')
    printValue('코스닥',dacRes)
    console.log('\n')
    printValue('환율 및 금 (16시00분 기준)',globalIndex)
}
kospiInfo()