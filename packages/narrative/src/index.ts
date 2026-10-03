import type {DomainEvent} from '../../domain/src/index';
export interface NewsArticle {eventId:string; title:string; category:string; tick:number;}
export interface NarrativeProvider {generateNews(event:DomainEvent):NewsArticle;}
const money=(n:unknown)=>typeof n==='number'?`$${(n/100).toLocaleString('en-US',{maximumFractionDigits:0})}`:'';
export class TemplateNarrativeProvider implements NarrativeProvider {
  generateNews(e:DomainEvent):NewsArticle {const p=e.payload;let title:string;
    switch(e.type){
      case 'CITY_FOUNDED':title=`城市成立，${p.population} 位居民開始共同生活。`;break;
      case 'CITIZEN_MIGRATED_IN':title=`${p.name} ${p.initial?'加入初始人口':'遷入城市'}。`;break;
      case 'CITIZEN_MIGRATED_OUT':title=`${p.name} 因長期財務困難離開城市。`;break;
      case 'CITIZEN_HIRED':title=`${p.name} 加入 ${p.company}，月薪 ${money(p.salary)}。`;break;
      case 'CITIZEN_FIRED':title=`${p.name} 失去 ${p.company} 的工作。`;break;
      case 'CITIZEN_QUIT':title=`${p.name} 離開 ${p.company} 的職位。`;break;
      case 'COMPANY_CREATED':title=`${p.name} 成立，進入 ${p.industry} 產業。`;break;
      case 'COMPANY_LAYOFF':title=`${p.name} 因持續虧損裁員 ${p.workers} 人。`;break;
      case 'COMPANY_BANKRUPT':title=`${p.name} 因資金不足倒閉，影響 ${p.workers} 位員工。`;break;
      case 'POLICY_CHANGED':title=`${p.policy} 從 ${p.oldValue} 調整為 ${p.value}。`;break;
      case 'HOUSING_BUILT':title=`城市新增 ${p.units} 戶住宅，支出 ${money(p.cost)}。`;break;
      case 'RENT_CHANGED':title=`${p.district} 一戶住宅月租從 ${money(p.oldRent)} 調整為 ${money(p.rent)}。`;break;
      case 'HOUSEHOLD_MOVED':title=`家庭${p.initial?'入住':'搬至'}月租 ${money(p.rent)} 的住宅。`;break;
      case 'HOUSEHOLD_INCOME_DROP':title=`家庭每月薪資減少 ${money(p.monthlyLoss)}。`;break;
      case 'RENT_DEFAULT':title=`家庭租金欠付 ${money(p.unpaid)}，累計欠款 ${money(p.debt)}。`;break;
      case 'CITIZEN_BORN':title=`${p.name} 出生。`;break;
      case 'CITIZEN_DIED':title=`${p.name} 於 ${p.age} 歲離世。`;break;
      case 'WORKFORCE_ENTERED':title=`${p.name} 成年，開始尋找工作。`;break;
      case 'CITIZEN_RETIRED':title=`${p.name} 退休。`;break;
    }
    return {eventId:e.id,title,category:e.category,tick:e.tick};
  }
}
export const narrative=new TemplateNarrativeProvider();
