window.COFFEE_DATA = {
  roasts:[
    {id:'light',label:'浅煎り'},
    {id:'mediumLight',label:'中浅煎り'},
    {id:'medium',label:'中煎り'},
    {id:'mediumDark',label:'中深煎り'},
    {id:'dark',label:'深煎り（表面に油が出る）'}
  ],
  brewers:[
    {id:'63metal',label:'ロクサン ステンレスフィルター',type:'metal'},
    {id:'harioSwitch',label:'HARIO Switch',type:'immersion'},
    {id:'v60',label:'HARIO V60 + ペーパー',type:'paper'},
    {id:'genericMetal',label:'その他ステンレス/金属フィルター',type:'metal'},
    {id:'genericPaper',label:'その他ペーパードリッパー',type:'paper'}
  ],
  grinders:[
    {id:'c5pro',label:'TIMEMORE C5 Pro',unit:'クリック',hint:'実機の見た目と味を優先。現在の基準は25。'},
    {id:'generic',label:'その他 / 手入力',unit:'設定値',hint:'同じグラインダー内で相対比較してください。'}
  ],
  preferences:[
    {id:'sweetness',label:'甘さ',default:4},
    {id:'aroma',label:'香り',default:4},
    {id:'clarity',label:'すっきり',default:4},
    {id:'body',label:'コク',default:2},
    {id:'acidity',label:'酸味',default:2},
    {id:'bitterness',label:'苦味',default:1}
  ],
  taste:[
    {id:'bitterness',label:'苦味',default:2},
    {id:'acidity',label:'酸味',default:2},
    {id:'sweetness',label:'甘さ',default:3},
    {id:'body',label:'コク',default:3},
    {id:'aroma',label:'香り',default:3}
  ],
  baseline:{
    beanName:'コロンビア',roast:'dark',brewer:'63metal',grinder:'c5pro',
    dose:10,water:260,temp:93,grind:25,pourEnd:120,drawdown:138,
    steps:[
      {time:0,label:'蒸らし',target:'30〜40gを目安に全体を濡らす'},
      {time:30,label:'本抽出',target:'260gまで数回に分けて注ぐ'},
      {time:120,label:'注ぎ終わり',target:'260g・注湯停止'},
      {time:138,label:'落ち切り目安',target:'ドリッパーを外す'}
    ]
  }
};
