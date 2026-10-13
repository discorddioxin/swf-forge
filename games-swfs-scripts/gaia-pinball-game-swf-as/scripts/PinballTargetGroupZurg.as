package
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.compound_elements.TargetGroup;
   import flash.utils.Dictionary;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1481")]
   public dynamic class PinballTargetGroupZurg extends TargetGroup
   {
      
      public var __setPropDict:Dictionary = new Dictionary(true);
      
      public function PinballTargetGroupZurg()
      {
         super();
         addFrameScript(0,frame1,900,frame901,1,frame2,2,frame3,3,frame4,4,frame5,5,frame6,6,frame7,7,frame8,8,frame9,9,frame10,10,frame11,11,frame12,12,frame13,13,frame14,14,frame15,15,frame16,16,frame17,17,frame18,18,frame19,19,frame20,20,frame21,21,frame22,22,frame23,23,frame24,24,frame25,25,frame26,26,frame27,27,frame28,28,frame29,29,frame30,30,frame31,31,frame32,32,frame33,33,frame34,34,frame35,35,frame36,36,frame37,37,frame38,38,frame39,39,frame40,40,frame41,41,frame42,42,frame43,43,frame44,44,frame45,45,frame46,46,frame47,47,frame48,48,frame49,49,frame50,50,frame51,51,frame52,52,frame53,53,frame54,54,frame55,55,frame56,56,frame57,57,frame58,58,frame59,59,frame60,60,frame61,61,frame62,62,frame63,63,frame64,64,frame65,65,frame66,66,frame67,67,frame68,68,frame69,69,frame70,70,frame71,71,frame72,72,frame73,73,frame74,74,frame75,75,frame76,76,frame77,77,frame78,78,frame79,79,frame80,80,frame81,81,frame82,82,frame83,83,frame84,84,frame85,85,frame86,86,frame87,87,frame88,88,frame89,89,frame90,90
         ,frame91,91,frame92,92,frame93,93,frame94,94,frame95,95,frame96,96,frame97,97,frame98,98,frame99,99,frame100,100,frame101,101,frame102,102,frame103,103,frame104,104,frame105,105,frame106,106,frame107,107,frame108,108,frame109,109,frame110,110,frame111,111,frame112,112,frame113,113,frame114,114,frame115,115,frame116,116,frame117,117,frame118,118,frame119,119,frame120,120,frame121,121,frame122,122,frame123,123,frame124,124,frame125,125,frame126,126,frame127,127,frame128,128,frame129,129,frame130,130,frame131,131,frame132,132,frame133,133,frame134,134,frame135,135,frame136,136,frame137,137,frame138,138,frame139,139,frame140,140,frame141,141,frame142,142,frame143,143,frame144,144,frame145,145,frame146,146,frame147,147,frame148,148,frame149,149,frame150,150,frame151,151,frame152,152,frame153,153,frame154,154,frame155,155,frame156,156,frame157,157,frame158,158,frame159,159,frame160,160,frame161,161,frame162,162,frame163,163,frame164,164,frame165,165,frame166,166,frame167,167,frame168,168,frame169
         ,169,frame170,170,frame171,171,frame172,172,frame173,173,frame174,174,frame175,175,frame176,176,frame177,177,frame178,178,frame179,179,frame180,180,frame181,181,frame182,182,frame183,183,frame184,184,frame185,185,frame186,186,frame187,187,frame188,188,frame189,189,frame190,190,frame191,191,frame192,192,frame193,193,frame194,194,frame195,195,frame196,196,frame197,197,frame198,198,frame199,199,frame200,200,frame201,201,frame202,202,frame203,203,frame204,204,frame205,205,frame206,206,frame207,207,frame208,208,frame209,209,frame210,210,frame211,211,frame212,212,frame213,213,frame214,214,frame215,215,frame216,216,frame217,217,frame218,218,frame219,219,frame220,220,frame221,221,frame222,222,frame223,223,frame224,224,frame225,225,frame226,226,frame227,227,frame228,228,frame229,229,frame230,230,frame231,231,frame232,232,frame233,233,frame234,234,frame235,235,frame236,236,frame237,237,frame238,238,frame239,239,frame240,240,frame241,241,frame242,242,frame243,243,frame244,244,frame245,245,frame246
         ,246,frame247,247,frame248,248,frame249,249,frame250,250,frame251,251,frame252,252,frame253,253,frame254,254,frame255,255,frame256,256,frame257,257,frame258,258,frame259,259,frame260,260,frame261,261,frame262,262,frame263,263,frame264,264,frame265,265,frame266,266,frame267,267,frame268,268,frame269,269,frame270,270,frame271,271,frame272,272,frame273,273,frame274,274,frame275,275,frame276,276,frame277,277,frame278,278,frame279,279,frame280,280,frame281,281,frame282,282,frame283,283,frame284,284,frame285,285,frame286,286,frame287,287,frame288,288,frame289,289,frame290,290,frame291,291,frame292,292,frame293,293,frame294,294,frame295,295,frame296,296,frame297,297,frame298,298,frame299,299,frame300,300,frame301,301,frame302,302,frame303,303,frame304,304,frame305,305,frame306,306,frame307,307,frame308,308,frame309,309,frame310,310,frame311,311,frame312,312,frame313,313,frame314,314,frame315,315,frame316,316,frame317,317,frame318,318,frame319,319,frame320,320,frame321,321,frame322,322,frame323
         ,323,frame324,324,frame325,325,frame326,326,frame327,327,frame328,328,frame329,329,frame330,330,frame331,331,frame332,332,frame333,333,frame334,334,frame335,335,frame336,336,frame337,337,frame338,338,frame339,339,frame340,340,frame341,341,frame342,342,frame343,343,frame344,344,frame345,345,frame346,346,frame347,347,frame348,348,frame349,349,frame350,350,frame351,351,frame352,352,frame353,353,frame354,354,frame355,355,frame356,356,frame357,357,frame358,358,frame359,359,frame360,360,frame361,361,frame362,362,frame363,363,frame364,364,frame365,365,frame366,366,frame367,367,frame368,368,frame369,369,frame370,370,frame371,371,frame372,372,frame373,373,frame374,374,frame375,375,frame376,376,frame377,377,frame378,378,frame379,379,frame380,380,frame381,381,frame382,382,frame383,383,frame384,384,frame385,385,frame386,386,frame387,387,frame388,388,frame389,389,frame390,390,frame391,391,frame392,392,frame393,393,frame394,394,frame395,395,frame396,396,frame397,397,frame398,398,frame399,399,frame400
         ,400,frame401,401,frame402,402,frame403,403,frame404,404,frame405,405,frame406,406,frame407,407,frame408,408,frame409,409,frame410,410,frame411,411,frame412,412,frame413,413,frame414,414,frame415,415,frame416,416,frame417,417,frame418,418,frame419,419,frame420,420,frame421,421,frame422,422,frame423,423,frame424,424,frame425,425,frame426,426,frame427,427,frame428,428,frame429,429,frame430,430,frame431,431,frame432,432,frame433,433,frame434,434,frame435,435,frame436,436,frame437,437,frame438,438,frame439,439,frame440,440,frame441,441,frame442,442,frame443,443,frame444,444,frame445,445,frame446,446,frame447,447,frame448,448,frame449,449,frame450,450,frame451,451,frame452,452,frame453,453,frame454,454,frame455,455,frame456,456,frame457,457,frame458,458,frame459,459,frame460,460,frame461,461,frame462,462,frame463,463,frame464,464,frame465,465,frame466,466,frame467,467,frame468,468,frame469,469,frame470,470,frame471,471,frame472,472,frame473,473,frame474,474,frame475,475,frame476,476,frame477
         ,477,frame478,478,frame479,479,frame480,480,frame481,481,frame482,482,frame483,483,frame484,484,frame485,485,frame486,486,frame487,487,frame488,488,frame489,489,frame490,490,frame491,491,frame492,492,frame493,493,frame494,494,frame495,495,frame496,496,frame497,497,frame498,498,frame499,499,frame500,500,frame501,501,frame502,502,frame503,503,frame504,504,frame505,505,frame506,506,frame507,507,frame508,508,frame509,509,frame510,510,frame511,511,frame512,512,frame513,513,frame514,514,frame515,515,frame516,516,frame517,517,frame518,518,frame519,519,frame520,520,frame521,521,frame522,522,frame523,523,frame524,524,frame525,525,frame526,526,frame527,527,frame528,528,frame529,529,frame530,530,frame531,531,frame532,532,frame533,533,frame534,534,frame535,535,frame536,536,frame537,537,frame538,538,frame539,539,frame540,540,frame541,541,frame542,542,frame543,543,frame544,544,frame545,545,frame546,546,frame547,547,frame548,548,frame549,549,frame550,550,frame551,551,frame552,552,frame553,553,frame554
         ,554,frame555,555,frame556,556,frame557,557,frame558,558,frame559,559,frame560,560,frame561,561,frame562,562,frame563,563,frame564,564,frame565,565,frame566,566,frame567,567,frame568,568,frame569,569,frame570,570,frame571,571,frame572,572,frame573,573,frame574,574,frame575,575,frame576,576,frame577,577,frame578,578,frame579,579,frame580,580,frame581,581,frame582,582,frame583,583,frame584,584,frame585,585,frame586,586,frame587,587,frame588,588,frame589,589,frame590,590,frame591,591,frame592,592,frame593,593,frame594,594,frame595,595,frame596,596,frame597,597,frame598,598,frame599,599,frame600,600,frame601,601,frame602,602,frame603,603,frame604,604,frame605,605,frame606,606,frame607,607,frame608,608,frame609,609,frame610,610,frame611,611,frame612,612,frame613,613,frame614,614,frame615,615,frame616,616,frame617,617,frame618,618,frame619,619,frame620,620,frame621,621,frame622,622,frame623,623,frame624,624,frame625,625,frame626,626,frame627,627,frame628,628,frame629,629,frame630,630,frame631
         ,631,frame632,632,frame633,633,frame634,634,frame635,635,frame636,636,frame637,637,frame638,638,frame639,639,frame640,640,frame641,641,frame642,642,frame643,643,frame644,644,frame645,645,frame646,646,frame647,647,frame648,648,frame649,649,frame650,650,frame651,651,frame652,652,frame653,653,frame654,654,frame655,655,frame656,656,frame657,657,frame658,658,frame659,659,frame660,660,frame661,661,frame662,662,frame663,663,frame664,664,frame665,665,frame666,666,frame667,667,frame668,668,frame669,669,frame670,670,frame671,671,frame672,672,frame673,673,frame674,674,frame675,675,frame676,676,frame677,677,frame678,678,frame679,679,frame680,680,frame681,681,frame682,682,frame683,683,frame684,684,frame685,685,frame686,686,frame687,687,frame688,688,frame689,689,frame690,690,frame691,691,frame692,692,frame693,693,frame694,694,frame695,695,frame696,696,frame697,697,frame698,698,frame699,699,frame700,700,frame701,701,frame702,702,frame703,703,frame704,704,frame705,705,frame706,706,frame707,707,frame708
         ,708,frame709,709,frame710,710,frame711,711,frame712,712,frame713,713,frame714,714,frame715,715,frame716,716,frame717,717,frame718,718,frame719,719,frame720,720,frame721,721,frame722,722,frame723,723,frame724,724,frame725,725,frame726,726,frame727,727,frame728,728,frame729,729,frame730,730,frame731,731,frame732,732,frame733,733,frame734,734,frame735,735,frame736,736,frame737,737,frame738,738,frame739,739,frame740,740,frame741,741,frame742,742,frame743,743,frame744,744,frame745,745,frame746,746,frame747,747,frame748,748,frame749,749,frame750,750,frame751,751,frame752,752,frame753,753,frame754,754,frame755,755,frame756,756,frame757,757,frame758,758,frame759,759,frame760,760,frame761,761,frame762,762,frame763,763,frame764,764,frame765,765,frame766,766,frame767,767,frame768,768,frame769,769,frame770,770,frame771,771,frame772,772,frame773,773,frame774,774,frame775,775,frame776,776,frame777,777,frame778,778,frame779,779,frame780,780,frame781,781,frame782,782,frame783,783,frame784,784,frame785
         ,785,frame786,786,frame787,787,frame788,788,frame789,789,frame790,790,frame791,791,frame792,792,frame793,793,frame794,794,frame795,795,frame796,796,frame797,797,frame798,798,frame799,799,frame800,800,frame801,801,frame802,802,frame803,803,frame804,804,frame805,805,frame806,806,frame807,807,frame808,808,frame809,809,frame810,810,frame811,811,frame812,812,frame813,813,frame814,814,frame815,815,frame816,816,frame817,817,frame818,818,frame819,819,frame820,820,frame821,821,frame822,822,frame823,823,frame824,824,frame825,825,frame826,826,frame827,827,frame828,828,frame829,829,frame830,830,frame831,831,frame832,832,frame833,833,frame834,834,frame835,835,frame836,836,frame837,837,frame838,838,frame839,839,frame840,840,frame841,841,frame842,842,frame843,843,frame844,844,frame845,845,frame846,846,frame847,847,frame848,848,frame849,849,frame850,850,frame851,851,frame852,852,frame853,853,frame854,854,frame855,855,frame856,856,frame857,857,frame858,858,frame859,859,frame860,860,frame861,861,frame862
         ,862,frame863,863,frame864,864,frame865,865,frame866,866,frame867,867,frame868,868,frame869,869,frame870,870,frame871,871,frame872,872,frame873,873,frame874,874,frame875,875,frame876,876,frame877,877,frame878,878,frame879,879,frame880,880,frame881,881,frame882,882,frame883,883,frame884,884,frame885,885,frame886,886,frame887,887,frame888,888,frame889,889,frame890,890,frame891,891,frame892,892,frame893,893,frame894,894,frame895,895,frame896,896,frame897,897,frame898,898,frame899,899,frame900);
      }
      
      internal function frame710() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame712() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame713() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame714() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame715() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame716() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame717() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame711() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame719() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame718() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame720() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame721() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame723() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame724() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame725() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame726() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame728() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame722() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame727() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame729() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame730() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame731() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame732() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame733() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame734() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame10() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame11() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame15() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame16() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame12() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame14() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame17() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame19() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame737() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame739() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame18() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame735() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame736() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame740() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame13() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame500() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame501() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame502() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame20() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame21() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame22() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame23() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame24() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame25() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame26() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame504() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame29() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame506() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame507() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame508() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame28() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame746() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame505() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame748() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame749() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame741() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame509() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame27() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame744() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame503() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame747() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame751() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame510() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame511() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame512() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame31() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame32() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame33() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame34() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame35() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame36() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame30() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame38() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame39() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame517() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame518() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame519() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame37() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame513() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame514() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame515() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame750() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame752() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame742() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame743() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame738() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame745() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame516() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame520() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame521() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame522() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame40() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame42() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame43() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame44() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame45() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame46() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame47() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame41() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame526() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame527() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame528() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame755() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame48() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame525() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame759() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame760() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame761() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame529() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame50() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame51() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame49() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame53() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame54() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame55() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame56() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame58() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame52() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame536() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame537() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame538() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame539() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame57() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame524() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame59() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame535() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame769() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame770() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame753() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame530() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame531() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame532() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame533() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame534() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame766() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame541() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame300() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame60() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame61() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame62() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame63() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame64() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame65() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame66() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame67() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame68() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame304() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame306() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame308() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame301() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame69() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame303() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame546() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame305() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame307() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame523() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame309() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame543() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame545() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame776() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame551() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame310() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame70() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame71() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame72() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame73() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame75() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame76() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame77() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame78() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame79() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame314() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame74() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame316() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame317() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame318() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame302() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame313() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame547() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame315() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame549() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame550() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame765() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame319() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame312() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame555() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame560() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame561() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame320() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame80() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame81() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame83() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame84() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame85() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame86() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame87() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame88() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame82() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame324() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame325() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame326() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame327() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame311() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame329() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame89() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame323() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame540() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame568() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame542() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame328() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame562() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame321() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame322() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame565() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame570() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame556() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame330() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame90() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame91() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame92() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame93() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame94() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame95() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame96() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame98() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame99() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame334() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame335() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame336() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame337() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame97() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame331() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame332() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame333() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame567() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame577() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame578() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame552() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame338() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame339() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame573() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame574() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame564() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame580() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame566() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame340() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame341() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame100() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame101() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame102() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame105() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame106() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame107() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame108() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame109() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame103() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame104() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame347() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame348() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame349() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame342() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame343() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame345() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame346() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame589() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame553() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame554() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame571() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame572() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame557() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame590() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame350() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame110() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame112() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame114() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame116() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame111() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame113() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame115() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame117() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame118() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame119() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame354() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame355() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame356() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame357() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame358() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame351() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame352() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame353() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame584() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame597() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_901() : *
      {
         try
         {
            target0["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         target0.__Active = true;
         target0.__GroupQueue = "__HitQueue";
         target0.__DropLevel = 1;
         target0.__LightLevel = 1;
         target0.__Location = "useParent";
         target0.__ScoreLink = "genericTarget";
         target0.__SndEffectLevel = false;
         target0.__SndEffectHit = "none";
         target0.__SndEffectUnhit = "none";
         target0.__TargetType = "drop";
         try
         {
            target0["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame360() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame361() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame120() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame121() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame122() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame123() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame124() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame125() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame126() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame127() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame128() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame344() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame366() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame367() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame368() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame369() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame362() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame129() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame364() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame365() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame599() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame582() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame359() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame784() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame575() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame544() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame363() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame588() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame579() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame548() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame370() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame130() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame131() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame132() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame134() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame135() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame136() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame137() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame138() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame139() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame133() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame377() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame378() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame371() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame373() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame375() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame376() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame592() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame583() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame379() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame585() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame372() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame587() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame374() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame768() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame576() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame380() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame381() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame140() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame141() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame142() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame143() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame144() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame145() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame146() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame147() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame148() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame149() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame385() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame386() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame389() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame383() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame384() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame758() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame591() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame387() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame388() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame594() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame563() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame382() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame780() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame598() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame778() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame586() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame390() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame391() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame150() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame151() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame152() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame153() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame154() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame155() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame156() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame157() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame158() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame159() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame395() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame396() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame397() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame398() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame399() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame392() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame393() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame394() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame775() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame569() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame777() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame783() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame779() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame785() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame593() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame787() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame595() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame596() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame794() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame795() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame160() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame161() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame162() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame163() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame165() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame166() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame167() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame168() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame169() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame763() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame164() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame757() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame773() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame767() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame781() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame782() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame790() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame786() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame581() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame788() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame789() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame796() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame797() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame799() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame558() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame170() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame171() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame172() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame174() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame176() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame177() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame178() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame179() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame774() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame175() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame791() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame792() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame173() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame798() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame559() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame180() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame181() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame182() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame183() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame184() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame185() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame186() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame187() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame189() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame756() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame793() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame188() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame190() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame191() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame193() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame194() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame195() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame196() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame197() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame198() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame192() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame199() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame771() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame772() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame762() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame764() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame754() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1() : *
      {
         try
         {
            target0["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         target0.__Active = true;
         target0.__GroupQueue = "__HitQueue";
         target0.__DropLevel = 1;
         target0.__LightLevel = 1;
         target0.__Location = "useParent";
         target0.__ScoreLink = "zurgTarget";
         target0.__SndEffectLevel = false;
         target0.__SndEffectHit = "none";
         target0.__SndEffectUnhit = "none";
         target0.__TargetType = "spot";
         try
         {
            target0["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame800() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame801() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame802() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame803() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame804() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame805() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame806() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame807() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame808() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame809() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame810() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame811() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame812() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame813() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame814() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame815() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame816() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame817() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame818() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame819() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame820() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame821() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame822() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame823() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame824() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame825() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame826() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame827() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame828() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame829() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame830() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame831() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame832() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame833() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame834() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame835() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame836() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame837() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame838() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame839() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame840() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame841() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame600() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame601() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame602() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame603() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame604() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame605() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame606() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame607() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame608() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame609() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame845() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame846() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame847() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame848() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame849() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame842() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame843() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame844() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame850() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame851() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame610() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame611() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame614() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame615() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame616() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame617() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame618() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame619() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame613() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame856() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame857() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame858() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame859() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame852() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame853() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame612() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame855() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame854() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame1() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
         popAll();
         stop();
      }
      
      internal function frame2() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame3() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame4() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame5() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame6() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame7() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame8() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame9() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame626() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame620() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame621() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame622() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame623() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame624() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame625() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame860() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame627() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame628() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame629() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame864() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame865() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame867() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame868() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame869() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame861() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame862() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame866() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame870() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame630() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame631() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame632() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame633() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame634() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame635() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame636() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame638() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame639() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame875() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame876() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame877() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame878() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame637() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame863() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame873() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame874() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame879() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame871() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame872() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame880() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame881() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame640() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame641() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame400() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame402() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame403() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame404() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame405() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame406() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame407() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame401() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame409() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame645() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame646() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame647() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame649() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame643() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame644() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame887() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame888() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame889() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame648() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame882() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame408() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame642() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame885() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame886() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame890() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame891() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame650() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame651() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame410() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame411() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame412() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame413() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame414() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame415() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame416() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame417() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame418() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame419() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame655() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame656() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame657() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame658() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame659() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame652() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame653() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame654() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame897() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame898() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame899() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame892() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame893() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame894() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame883() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame884() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame660() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame661() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame420() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame422() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame423() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame424() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame425() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame426() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame427() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame429() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame665() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame666() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame667() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame668() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame669() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame428() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame421() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame664() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame662() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame663() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame895() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame896() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame670() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame671() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame430() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame431() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame432() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame433() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame434() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame435() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame436() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame437() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame439() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame675() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame676() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame678() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame679() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame438() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame673() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame674() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame677() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame672() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame680() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame681() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame440() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame441() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame200() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame201() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame202() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame203() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame204() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame205() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame206() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame207() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame208() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame209() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame445() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame446() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame447() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame448() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame449() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame442() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame443() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame444() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame687() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame688() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame689() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame682() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame683() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame684() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame685() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame690() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame691() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame450() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame451() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame210() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame211() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame212() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame213() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame214() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame215() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame216() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame217() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame218() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame219() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame455() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame456() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame457() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame458() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame459() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame452() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame453() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame454() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame697() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame698() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame699() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame692() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame693() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame694() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame695() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame696() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame460() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame461() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame220() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame221() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame222() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame223() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame224() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame225() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame226() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame227() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame228() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame229() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame465() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame466() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame467() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame468() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame469() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame462() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame463() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame464() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame686() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame471() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame230() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame231() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame232() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame233() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame235() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame236() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame237() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame238() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame239() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame477() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame478() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame479() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame472() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame473() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame474() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame234() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame470() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame475() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame476() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame480() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame481() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame240() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame241() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame243() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame244() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame245() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame246() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame247() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame248() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame249() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame485() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame486() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame487() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame488() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame489() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame482() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame483() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame242() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame484() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame490() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame250() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame251() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame252() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame253() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame254() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame255() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame257() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame258() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame259() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame495() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame497() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame491() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame492() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame493() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame494() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame496() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame256() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame499() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame498() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame260() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame261() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame262() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame263() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame264() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame265() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame266() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame267() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame268() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame269() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame270() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame271() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame272() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame273() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame274() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame275() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame276() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame277() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame278() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame279() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame280() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame281() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame283() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame284() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame285() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame286() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame287() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame288() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame282() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame289() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame290() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame292() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame293() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame294() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame296() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame297() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame291() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame299() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame295() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame298() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame900() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame901() : *
      {
         if(__setPropDict[target0] == undefined || int(__setPropDict[target0]) != 901)
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_901();
         }
         if(target0.__Active)
         {
            PinballCore.__Root.zurgEscaped();
         }
      }
      
      internal function frame701() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame702() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame703() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame704() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame705() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame706() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame700() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame708() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame709() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
      
      internal function frame707() : *
      {
         if(__setPropDict[target0] == undefined || !(int(__setPropDict[target0]) >= 1 && int(__setPropDict[target0]) <= 900))
         {
            __setPropDict[target0] = currentFrame;
            __setProp_target0_mcPinballMachineTargetGroupZurg_Layer1_1();
         }
      }
   }
}

