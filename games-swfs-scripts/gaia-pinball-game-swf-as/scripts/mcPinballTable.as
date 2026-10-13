package
{
   import adobe.utils.*;
   import com.gaiaonline.games.gPinball.PinballTable;
   import flash.accessibility.*;
   import flash.display.*;
   import flash.errors.*;
   import flash.events.*;
   import flash.external.*;
   import flash.filters.*;
   import flash.geom.*;
   import flash.media.*;
   import flash.net.*;
   import flash.printing.*;
   import flash.system.*;
   import flash.text.*;
   import flash.ui.*;
   import flash.utils.*;
   import flash.xml.*;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1591")]
   public dynamic class mcPinballTable extends PinballTable
   {
      
      public var __setPropDict:Dictionary = new Dictionary(true);
      
      public var __id0_:PinballTrigger;
      
      public var __id1_:PinballBooster;
      
      public var __id2_:PinballBooster;
      
      public var __id3_:PinballBooster;
      
      public var __id4_:PinballBooster;
      
      public var __id5_:PinballBooster;
      
      public function mcPinballTable()
      {
         super();
         addFrameScript(0,frame1,2,frame3,8,frame9,1,frame2,3,frame4,4,frame5,5,frame6,6,frame7,7,frame8);
         __setProp_r_flipper_c_mcPinballMachine_Flippers_1();
         __setProp_l_flipper_c_mcPinballMachine_Flippers_1();
      }
      
      internal function __setProp_arenaBumper2_mcPinballMachine_VoteBumpers_2() : *
      {
         try
         {
            arenaBumper2["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         arenaBumper2.__ArtLevel = 1;
         arenaBumper2.__Power = 3;
         arenaBumper2.__Location = "table";
         arenaBumper2.__ScoreLink = "voteBumper";
         arenaBumper2.__SndEffectLevel = true;
         arenaBumper2.__SndEffectHit = "arenabumper2";
         try
         {
            arenaBumper2["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp___id5__mcPinballMachine_Shortcut_2() : *
      {
         try
         {
            __id5_["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         __id5_.__MyLocation = "table";
         __id5_.__OverDir = true;
         __id5_.__Power = 5;
         __id5_.__MySndEffect = "none";
         try
         {
            __id5_["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_gift5_mcPinballMachine_Gifts_2() : *
      {
         try
         {
            gift5["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gift5.__Active = true;
         gift5.__GroupQueue = "__HitQueue";
         gift5.__DropLevel = 1;
         gift5.__LightLevel = 1;
         gift5.__Location = "table";
         gift5.__ScoreLink = "giftBox";
         gift5.__SndEffectLevel = false;
         gift5.__SndEffectHit = "coinlight";
         gift5.__SndEffectUnhit = "none";
         gift5.__TargetType = "spot";
         try
         {
            gift5["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_arenaBumper1_mcPinballMachine_VoteBumpers_2() : *
      {
         try
         {
            arenaBumper1["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         arenaBumper1.__ArtLevel = 1;
         arenaBumper1.__Power = 3;
         arenaBumper1.__Location = "table";
         arenaBumper1.__ScoreLink = "voteBumper";
         arenaBumper1.__SndEffectLevel = true;
         arenaBumper1.__SndEffectHit = "arenabumper1";
         try
         {
            arenaBumper1["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_tradeTargets_mcPinballMachine_TradeTargets_2() : *
      {
         try
         {
            tradeTargets["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         tradeTargets.__AutoPop = false;
         tradeTargets.__CompFuncStr = "tradeComplete";
         tradeTargets.__Location = "table";
         tradeTargets.__MaxDrops = 1;
         tradeTargets.__MaxLevel = 1;
         tradeTargets.__PopAudio = "none";
         tradeTargets.__PopupTime = 250;
         tradeTargets.__GroupScoreLink = "tradeTarget";
         tradeTargets.__GroupQueue = "__TradeQueue";
         tradeTargets.__GroupTargetType = "spot";
         try
         {
            tradeTargets["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_arenaBumper0_mcPinballMachine_VoteBumpers_2() : *
      {
         try
         {
            arenaBumper0["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         arenaBumper0.__ArtLevel = 1;
         arenaBumper0.__Power = 3;
         arenaBumper0.__Location = "table";
         arenaBumper0.__ScoreLink = "voteBumper";
         arenaBumper0.__SndEffectLevel = true;
         arenaBumper0.__SndEffectHit = "arenabumper0";
         try
         {
            arenaBumper0["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame1() : *
      {
         stop();
      }
      
      internal function frame2() : *
      {
         if(__setPropDict[kicker_lc] == undefined || !(int(__setPropDict[kicker_lc]) >= 2 && int(__setPropDict[kicker_lc]) <= 9))
         {
            __setPropDict[kicker_lc] = currentFrame;
            __setProp_kicker_lc_mcPinballMachine_FlipperZone_2();
         }
         if(__setPropDict[gift5] == undefined || !(int(__setPropDict[gift5]) >= 2 && int(__setPropDict[gift5]) <= 9))
         {
            __setPropDict[gift5] = currentFrame;
            __setProp_gift5_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift1] == undefined || !(int(__setPropDict[gift1]) >= 2 && int(__setPropDict[gift1]) <= 9))
         {
            __setPropDict[gift1] = currentFrame;
            __setProp_gift1_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[fishTargets] == undefined || !(int(__setPropDict[fishTargets]) >= 2 && int(__setPropDict[fishTargets]) <= 9))
         {
            __setPropDict[fishTargets] = currentFrame;
            __setProp_fishTargets_mcPinballMachine_FishTargets_2();
         }
         if(__setPropDict[guildTarget] == undefined || !(int(__setPropDict[guildTarget]) >= 2 && int(__setPropDict[guildTarget]) <= 9))
         {
            __setPropDict[guildTarget] = currentFrame;
            __setProp_guildTarget_mcPinballMachine_GuildTarget_2();
         }
         if(__setPropDict[gift15] == undefined || !(int(__setPropDict[gift15]) >= 2 && int(__setPropDict[gift15]) <= 9))
         {
            __setPropDict[gift15] = currentFrame;
            __setProp_gift15_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift14] == undefined || !(int(__setPropDict[gift14]) >= 2 && int(__setPropDict[gift14]) <= 9))
         {
            __setPropDict[gift14] = currentFrame;
            __setProp_gift14_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[cowTarget] == undefined || !(int(__setPropDict[cowTarget]) >= 2 && int(__setPropDict[cowTarget]) <= 9))
         {
            __setPropDict[cowTarget] = currentFrame;
            __setProp_cowTarget_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[gambinoSaucer] == undefined || !(int(__setPropDict[gambinoSaucer]) >= 2 && int(__setPropDict[gambinoSaucer]) <= 9))
         {
            __setPropDict[gambinoSaucer] = currentFrame;
            __setProp_gambinoSaucer_mcPinballMachine_GambinoSaucer_2();
         }
         if(__setPropDict[gambinoTargets] == undefined || !(int(__setPropDict[gambinoTargets]) >= 2 && int(__setPropDict[gambinoTargets]) <= 9))
         {
            __setPropDict[gambinoTargets] = currentFrame;
            __setProp_gambinoTargets_mcPinballMachine_GambinoTargets_2();
         }
         if(__setPropDict[slotsTargets] == undefined || !(int(__setPropDict[slotsTargets]) >= 2 && int(__setPropDict[slotsTargets]) <= 9))
         {
            __setPropDict[slotsTargets] = currentFrame;
            __setProp_slotsTargets_mcPinballMachine_SlotsTargets_2();
         }
         if(__setPropDict[fishBumper] == undefined || !(int(__setPropDict[fishBumper]) >= 2 && int(__setPropDict[fishBumper]) <= 9))
         {
            __setPropDict[fishBumper] = currentFrame;
            __setProp_fishBumper_mcPinballMachine_FishBumper_2();
         }
         if(__setPropDict[helsonSaucerExit] == undefined || !(int(__setPropDict[helsonSaucerExit]) >= 2 && int(__setPropDict[helsonSaucerExit]) <= 9))
         {
            __setPropDict[helsonSaucerExit] = currentFrame;
            __setProp_helsonSaucerExit_mcPinballMachine_Eject_2();
         }
         if(__setPropDict[kicker_rc] == undefined || !(int(__setPropDict[kicker_rc]) >= 2 && int(__setPropDict[kicker_rc]) <= 9))
         {
            __setPropDict[kicker_rc] = currentFrame;
            __setProp_kicker_rc_mcPinballMachine_FlipperZone_2();
         }
         if(__setPropDict[kicker_ra] == undefined || !(int(__setPropDict[kicker_ra]) >= 2 && int(__setPropDict[kicker_ra]) <= 9))
         {
            __setPropDict[kicker_ra] = currentFrame;
            __setProp_kicker_ra_mcPinballMachine_Arena_2();
         }
         if(__setPropDict[arenaBumper0] == undefined || !(int(__setPropDict[arenaBumper0]) >= 2 && int(__setPropDict[arenaBumper0]) <= 9))
         {
            __setPropDict[arenaBumper0] = currentFrame;
            __setProp_arenaBumper0_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[zurgTarget] == undefined || !(int(__setPropDict[zurgTarget]) >= 2 && int(__setPropDict[zurgTarget]) <= 9))
         {
            __setPropDict[zurgTarget] = currentFrame;
            __setProp_zurgTarget_mcPinballMachine_Zurg_2();
         }
         if(__setPropDict[arenaBumper1] == undefined || !(int(__setPropDict[arenaBumper1]) >= 2 && int(__setPropDict[arenaBumper1]) <= 9))
         {
            __setPropDict[arenaBumper1] = currentFrame;
            __setProp_arenaBumper1_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[__id3_] == undefined || !(int(__setPropDict[__id3_]) >= 2 && int(__setPropDict[__id3_]) <= 9))
         {
            __setPropDict[__id3_] = currentFrame;
            __setProp___id3__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[voteTargets] == undefined || !(int(__setPropDict[voteTargets]) >= 2 && int(__setPropDict[voteTargets]) <= 9))
         {
            __setPropDict[voteTargets] = currentFrame;
            __setProp_voteTargets_mcPinballMachine_VoteTargets_2();
         }
         if(__setPropDict[gift10] == undefined || !(int(__setPropDict[gift10]) >= 2 && int(__setPropDict[gift10]) <= 9))
         {
            __setPropDict[gift10] = currentFrame;
            __setProp_gift10_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift12] == undefined || !(int(__setPropDict[gift12]) >= 2 && int(__setPropDict[gift12]) <= 9))
         {
            __setPropDict[gift12] = currentFrame;
            __setProp_gift12_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift13] == undefined || !(int(__setPropDict[gift13]) >= 2 && int(__setPropDict[gift13]) <= 9))
         {
            __setPropDict[gift13] = currentFrame;
            __setProp_gift13_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift11] == undefined || !(int(__setPropDict[gift11]) >= 2 && int(__setPropDict[gift11]) <= 9))
         {
            __setPropDict[gift11] = currentFrame;
            __setProp_gift11_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[arenaBumper2] == undefined || !(int(__setPropDict[arenaBumper2]) >= 2 && int(__setPropDict[arenaBumper2]) <= 9))
         {
            __setPropDict[arenaBumper2] = currentFrame;
            __setProp_arenaBumper2_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[__id0_] == undefined || !(int(__setPropDict[__id0_]) >= 2 && int(__setPropDict[__id0_]) <= 9))
         {
            __setPropDict[__id0_] = currentFrame;
            __setProp___id0__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[gift2] == undefined || !(int(__setPropDict[gift2]) >= 2 && int(__setPropDict[gift2]) <= 9))
         {
            __setPropDict[gift2] = currentFrame;
            __setProp_gift2_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift6] == undefined || !(int(__setPropDict[gift6]) >= 2 && int(__setPropDict[gift6]) <= 9))
         {
            __setPropDict[gift6] = currentFrame;
            __setProp_gift6_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[rockpuppyTarget] == undefined || !(int(__setPropDict[rockpuppyTarget]) >= 2 && int(__setPropDict[rockpuppyTarget]) <= 9))
         {
            __setPropDict[rockpuppyTarget] = currentFrame;
            __setProp_rockpuppyTarget_mcPinballMachine_RockPuppy_2();
         }
         if(__setPropDict[__id2_] == undefined || !(int(__setPropDict[__id2_]) >= 2 && int(__setPropDict[__id2_]) <= 9))
         {
            __setPropDict[__id2_] = currentFrame;
            __setProp___id2__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[loganSaucer] == undefined || !(int(__setPropDict[loganSaucer]) >= 2 && int(__setPropDict[loganSaucer]) <= 9))
         {
            __setPropDict[loganSaucer] = currentFrame;
            __setProp_loganSaucer_mcPinballMachine_LoganSaucer_2();
         }
         if(__setPropDict[bot2Target] == undefined || !(int(__setPropDict[bot2Target]) >= 2 && int(__setPropDict[bot2Target]) <= 9))
         {
            __setPropDict[bot2Target] = currentFrame;
            __setProp_bot2Target_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[kicker_la] == undefined || !(int(__setPropDict[kicker_la]) >= 2 && int(__setPropDict[kicker_la]) <= 9))
         {
            __setPropDict[kicker_la] = currentFrame;
            __setProp_kicker_la_mcPinballMachine_Arena_2();
         }
         if(__setPropDict[__id4_] == undefined || !(int(__setPropDict[__id4_]) >= 2 && int(__setPropDict[__id4_]) <= 9))
         {
            __setPropDict[__id4_] = currentFrame;
            __setProp___id4__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[__id5_] == undefined || !(int(__setPropDict[__id5_]) >= 2 && int(__setPropDict[__id5_]) <= 9))
         {
            __setPropDict[__id5_] = currentFrame;
            __setProp___id5__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[gift3] == undefined || !(int(__setPropDict[gift3]) >= 2 && int(__setPropDict[gift3]) <= 9))
         {
            __setPropDict[gift3] = currentFrame;
            __setProp_gift3_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift7] == undefined || !(int(__setPropDict[gift7]) >= 2 && int(__setPropDict[gift7]) <= 9))
         {
            __setPropDict[gift7] = currentFrame;
            __setProp_gift7_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[bot1Target] == undefined || !(int(__setPropDict[bot1Target]) >= 2 && int(__setPropDict[bot1Target]) <= 9))
         {
            __setPropDict[bot1Target] = currentFrame;
            __setProp_bot1Target_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[grunnyTargets] == undefined || !(int(__setPropDict[grunnyTargets]) >= 2 && int(__setPropDict[grunnyTargets]) <= 9))
         {
            __setPropDict[grunnyTargets] = currentFrame;
            __setProp_grunnyTargets_mcPinballMachine_GrunnyTargets_2();
         }
         if(__setPropDict[safetySwitch] == undefined || !(int(__setPropDict[safetySwitch]) >= 2 && int(__setPropDict[safetySwitch]) <= 9))
         {
            __setPropDict[safetySwitch] = currentFrame;
            __setProp_safetySwitch_mcPinballMachine_LaunchAlley_2();
         }
         if(__setPropDict[gift4] == undefined || !(int(__setPropDict[gift4]) >= 2 && int(__setPropDict[gift4]) <= 9))
         {
            __setPropDict[gift4] = currentFrame;
            __setProp_gift4_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[__id1_] == undefined || !(int(__setPropDict[__id1_]) >= 2 && int(__setPropDict[__id1_]) <= 9))
         {
            __setPropDict[__id1_] = currentFrame;
            __setProp___id1__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[tradeTargets] == undefined || !(int(__setPropDict[tradeTargets]) >= 2 && int(__setPropDict[tradeTargets]) <= 9))
         {
            __setPropDict[tradeTargets] = currentFrame;
            __setProp_tradeTargets_mcPinballMachine_TradeTargets_2();
         }
         if(__setPropDict[gift9] == undefined || !(int(__setPropDict[gift9]) >= 2 && int(__setPropDict[gift9]) <= 9))
         {
            __setPropDict[gift9] = currentFrame;
            __setProp_gift9_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift8] == undefined || !(int(__setPropDict[gift8]) >= 2 && int(__setPropDict[gift8]) <= 9))
         {
            __setPropDict[gift8] = currentFrame;
            __setProp_gift8_mcPinballMachine_Gifts_2();
         }
      }
      
      internal function frame3() : *
      {
         if(__setPropDict[kicker_lc] == undefined || !(int(__setPropDict[kicker_lc]) >= 2 && int(__setPropDict[kicker_lc]) <= 9))
         {
            __setPropDict[kicker_lc] = currentFrame;
            __setProp_kicker_lc_mcPinballMachine_FlipperZone_2();
         }
         if(__setPropDict[gift5] == undefined || !(int(__setPropDict[gift5]) >= 2 && int(__setPropDict[gift5]) <= 9))
         {
            __setPropDict[gift5] = currentFrame;
            __setProp_gift5_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift1] == undefined || !(int(__setPropDict[gift1]) >= 2 && int(__setPropDict[gift1]) <= 9))
         {
            __setPropDict[gift1] = currentFrame;
            __setProp_gift1_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[fishTargets] == undefined || !(int(__setPropDict[fishTargets]) >= 2 && int(__setPropDict[fishTargets]) <= 9))
         {
            __setPropDict[fishTargets] = currentFrame;
            __setProp_fishTargets_mcPinballMachine_FishTargets_2();
         }
         if(__setPropDict[guildTarget] == undefined || !(int(__setPropDict[guildTarget]) >= 2 && int(__setPropDict[guildTarget]) <= 9))
         {
            __setPropDict[guildTarget] = currentFrame;
            __setProp_guildTarget_mcPinballMachine_GuildTarget_2();
         }
         if(__setPropDict[gift15] == undefined || !(int(__setPropDict[gift15]) >= 2 && int(__setPropDict[gift15]) <= 9))
         {
            __setPropDict[gift15] = currentFrame;
            __setProp_gift15_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift14] == undefined || !(int(__setPropDict[gift14]) >= 2 && int(__setPropDict[gift14]) <= 9))
         {
            __setPropDict[gift14] = currentFrame;
            __setProp_gift14_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[cowTarget] == undefined || !(int(__setPropDict[cowTarget]) >= 2 && int(__setPropDict[cowTarget]) <= 9))
         {
            __setPropDict[cowTarget] = currentFrame;
            __setProp_cowTarget_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[gambinoSaucer] == undefined || !(int(__setPropDict[gambinoSaucer]) >= 2 && int(__setPropDict[gambinoSaucer]) <= 9))
         {
            __setPropDict[gambinoSaucer] = currentFrame;
            __setProp_gambinoSaucer_mcPinballMachine_GambinoSaucer_2();
         }
         if(__setPropDict[gambinoTargets] == undefined || !(int(__setPropDict[gambinoTargets]) >= 2 && int(__setPropDict[gambinoTargets]) <= 9))
         {
            __setPropDict[gambinoTargets] = currentFrame;
            __setProp_gambinoTargets_mcPinballMachine_GambinoTargets_2();
         }
         if(__setPropDict[slotsTargets] == undefined || !(int(__setPropDict[slotsTargets]) >= 2 && int(__setPropDict[slotsTargets]) <= 9))
         {
            __setPropDict[slotsTargets] = currentFrame;
            __setProp_slotsTargets_mcPinballMachine_SlotsTargets_2();
         }
         if(__setPropDict[fishBumper] == undefined || !(int(__setPropDict[fishBumper]) >= 2 && int(__setPropDict[fishBumper]) <= 9))
         {
            __setPropDict[fishBumper] = currentFrame;
            __setProp_fishBumper_mcPinballMachine_FishBumper_2();
         }
         if(__setPropDict[helsonSaucerExit] == undefined || !(int(__setPropDict[helsonSaucerExit]) >= 2 && int(__setPropDict[helsonSaucerExit]) <= 9))
         {
            __setPropDict[helsonSaucerExit] = currentFrame;
            __setProp_helsonSaucerExit_mcPinballMachine_Eject_2();
         }
         if(__setPropDict[kicker_rc] == undefined || !(int(__setPropDict[kicker_rc]) >= 2 && int(__setPropDict[kicker_rc]) <= 9))
         {
            __setPropDict[kicker_rc] = currentFrame;
            __setProp_kicker_rc_mcPinballMachine_FlipperZone_2();
         }
         if(__setPropDict[kicker_ra] == undefined || !(int(__setPropDict[kicker_ra]) >= 2 && int(__setPropDict[kicker_ra]) <= 9))
         {
            __setPropDict[kicker_ra] = currentFrame;
            __setProp_kicker_ra_mcPinballMachine_Arena_2();
         }
         if(__setPropDict[arenaBumper0] == undefined || !(int(__setPropDict[arenaBumper0]) >= 2 && int(__setPropDict[arenaBumper0]) <= 9))
         {
            __setPropDict[arenaBumper0] = currentFrame;
            __setProp_arenaBumper0_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[zurgTarget] == undefined || !(int(__setPropDict[zurgTarget]) >= 2 && int(__setPropDict[zurgTarget]) <= 9))
         {
            __setPropDict[zurgTarget] = currentFrame;
            __setProp_zurgTarget_mcPinballMachine_Zurg_2();
         }
         if(__setPropDict[arenaBumper1] == undefined || !(int(__setPropDict[arenaBumper1]) >= 2 && int(__setPropDict[arenaBumper1]) <= 9))
         {
            __setPropDict[arenaBumper1] = currentFrame;
            __setProp_arenaBumper1_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[__id3_] == undefined || !(int(__setPropDict[__id3_]) >= 2 && int(__setPropDict[__id3_]) <= 9))
         {
            __setPropDict[__id3_] = currentFrame;
            __setProp___id3__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[voteTargets] == undefined || !(int(__setPropDict[voteTargets]) >= 2 && int(__setPropDict[voteTargets]) <= 9))
         {
            __setPropDict[voteTargets] = currentFrame;
            __setProp_voteTargets_mcPinballMachine_VoteTargets_2();
         }
         if(__setPropDict[gift10] == undefined || !(int(__setPropDict[gift10]) >= 2 && int(__setPropDict[gift10]) <= 9))
         {
            __setPropDict[gift10] = currentFrame;
            __setProp_gift10_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift12] == undefined || !(int(__setPropDict[gift12]) >= 2 && int(__setPropDict[gift12]) <= 9))
         {
            __setPropDict[gift12] = currentFrame;
            __setProp_gift12_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift13] == undefined || !(int(__setPropDict[gift13]) >= 2 && int(__setPropDict[gift13]) <= 9))
         {
            __setPropDict[gift13] = currentFrame;
            __setProp_gift13_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift11] == undefined || !(int(__setPropDict[gift11]) >= 2 && int(__setPropDict[gift11]) <= 9))
         {
            __setPropDict[gift11] = currentFrame;
            __setProp_gift11_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[arenaBumper2] == undefined || !(int(__setPropDict[arenaBumper2]) >= 2 && int(__setPropDict[arenaBumper2]) <= 9))
         {
            __setPropDict[arenaBumper2] = currentFrame;
            __setProp_arenaBumper2_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[__id0_] == undefined || !(int(__setPropDict[__id0_]) >= 2 && int(__setPropDict[__id0_]) <= 9))
         {
            __setPropDict[__id0_] = currentFrame;
            __setProp___id0__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[gift2] == undefined || !(int(__setPropDict[gift2]) >= 2 && int(__setPropDict[gift2]) <= 9))
         {
            __setPropDict[gift2] = currentFrame;
            __setProp_gift2_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift6] == undefined || !(int(__setPropDict[gift6]) >= 2 && int(__setPropDict[gift6]) <= 9))
         {
            __setPropDict[gift6] = currentFrame;
            __setProp_gift6_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[rockpuppyTarget] == undefined || !(int(__setPropDict[rockpuppyTarget]) >= 2 && int(__setPropDict[rockpuppyTarget]) <= 9))
         {
            __setPropDict[rockpuppyTarget] = currentFrame;
            __setProp_rockpuppyTarget_mcPinballMachine_RockPuppy_2();
         }
         if(__setPropDict[__id2_] == undefined || !(int(__setPropDict[__id2_]) >= 2 && int(__setPropDict[__id2_]) <= 9))
         {
            __setPropDict[__id2_] = currentFrame;
            __setProp___id2__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[loganSaucer] == undefined || !(int(__setPropDict[loganSaucer]) >= 2 && int(__setPropDict[loganSaucer]) <= 9))
         {
            __setPropDict[loganSaucer] = currentFrame;
            __setProp_loganSaucer_mcPinballMachine_LoganSaucer_2();
         }
         if(__setPropDict[bot2Target] == undefined || !(int(__setPropDict[bot2Target]) >= 2 && int(__setPropDict[bot2Target]) <= 9))
         {
            __setPropDict[bot2Target] = currentFrame;
            __setProp_bot2Target_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[kicker_la] == undefined || !(int(__setPropDict[kicker_la]) >= 2 && int(__setPropDict[kicker_la]) <= 9))
         {
            __setPropDict[kicker_la] = currentFrame;
            __setProp_kicker_la_mcPinballMachine_Arena_2();
         }
         if(__setPropDict[__id4_] == undefined || !(int(__setPropDict[__id4_]) >= 2 && int(__setPropDict[__id4_]) <= 9))
         {
            __setPropDict[__id4_] = currentFrame;
            __setProp___id4__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[__id5_] == undefined || !(int(__setPropDict[__id5_]) >= 2 && int(__setPropDict[__id5_]) <= 9))
         {
            __setPropDict[__id5_] = currentFrame;
            __setProp___id5__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[gift3] == undefined || !(int(__setPropDict[gift3]) >= 2 && int(__setPropDict[gift3]) <= 9))
         {
            __setPropDict[gift3] = currentFrame;
            __setProp_gift3_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift7] == undefined || !(int(__setPropDict[gift7]) >= 2 && int(__setPropDict[gift7]) <= 9))
         {
            __setPropDict[gift7] = currentFrame;
            __setProp_gift7_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[bot1Target] == undefined || !(int(__setPropDict[bot1Target]) >= 2 && int(__setPropDict[bot1Target]) <= 9))
         {
            __setPropDict[bot1Target] = currentFrame;
            __setProp_bot1Target_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[grunnyTargets] == undefined || !(int(__setPropDict[grunnyTargets]) >= 2 && int(__setPropDict[grunnyTargets]) <= 9))
         {
            __setPropDict[grunnyTargets] = currentFrame;
            __setProp_grunnyTargets_mcPinballMachine_GrunnyTargets_2();
         }
         if(__setPropDict[safetySwitch] == undefined || !(int(__setPropDict[safetySwitch]) >= 2 && int(__setPropDict[safetySwitch]) <= 9))
         {
            __setPropDict[safetySwitch] = currentFrame;
            __setProp_safetySwitch_mcPinballMachine_LaunchAlley_2();
         }
         if(__setPropDict[gift4] == undefined || !(int(__setPropDict[gift4]) >= 2 && int(__setPropDict[gift4]) <= 9))
         {
            __setPropDict[gift4] = currentFrame;
            __setProp_gift4_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[__id1_] == undefined || !(int(__setPropDict[__id1_]) >= 2 && int(__setPropDict[__id1_]) <= 9))
         {
            __setPropDict[__id1_] = currentFrame;
            __setProp___id1__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[tradeTargets] == undefined || !(int(__setPropDict[tradeTargets]) >= 2 && int(__setPropDict[tradeTargets]) <= 9))
         {
            __setPropDict[tradeTargets] = currentFrame;
            __setProp_tradeTargets_mcPinballMachine_TradeTargets_2();
         }
         if(__setPropDict[gift9] == undefined || !(int(__setPropDict[gift9]) >= 2 && int(__setPropDict[gift9]) <= 9))
         {
            __setPropDict[gift9] = currentFrame;
            __setProp_gift9_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift8] == undefined || !(int(__setPropDict[gift8]) >= 2 && int(__setPropDict[gift8]) <= 9))
         {
            __setPropDict[gift8] = currentFrame;
            __setProp_gift8_mcPinballMachine_Gifts_2();
         }
         initTable();
      }
      
      internal function frame4() : *
      {
         if(__setPropDict[kicker_lc] == undefined || !(int(__setPropDict[kicker_lc]) >= 2 && int(__setPropDict[kicker_lc]) <= 9))
         {
            __setPropDict[kicker_lc] = currentFrame;
            __setProp_kicker_lc_mcPinballMachine_FlipperZone_2();
         }
         if(__setPropDict[gift5] == undefined || !(int(__setPropDict[gift5]) >= 2 && int(__setPropDict[gift5]) <= 9))
         {
            __setPropDict[gift5] = currentFrame;
            __setProp_gift5_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift1] == undefined || !(int(__setPropDict[gift1]) >= 2 && int(__setPropDict[gift1]) <= 9))
         {
            __setPropDict[gift1] = currentFrame;
            __setProp_gift1_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[fishTargets] == undefined || !(int(__setPropDict[fishTargets]) >= 2 && int(__setPropDict[fishTargets]) <= 9))
         {
            __setPropDict[fishTargets] = currentFrame;
            __setProp_fishTargets_mcPinballMachine_FishTargets_2();
         }
         if(__setPropDict[guildTarget] == undefined || !(int(__setPropDict[guildTarget]) >= 2 && int(__setPropDict[guildTarget]) <= 9))
         {
            __setPropDict[guildTarget] = currentFrame;
            __setProp_guildTarget_mcPinballMachine_GuildTarget_2();
         }
         if(__setPropDict[gift15] == undefined || !(int(__setPropDict[gift15]) >= 2 && int(__setPropDict[gift15]) <= 9))
         {
            __setPropDict[gift15] = currentFrame;
            __setProp_gift15_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift14] == undefined || !(int(__setPropDict[gift14]) >= 2 && int(__setPropDict[gift14]) <= 9))
         {
            __setPropDict[gift14] = currentFrame;
            __setProp_gift14_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[cowTarget] == undefined || !(int(__setPropDict[cowTarget]) >= 2 && int(__setPropDict[cowTarget]) <= 9))
         {
            __setPropDict[cowTarget] = currentFrame;
            __setProp_cowTarget_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[gambinoSaucer] == undefined || !(int(__setPropDict[gambinoSaucer]) >= 2 && int(__setPropDict[gambinoSaucer]) <= 9))
         {
            __setPropDict[gambinoSaucer] = currentFrame;
            __setProp_gambinoSaucer_mcPinballMachine_GambinoSaucer_2();
         }
         if(__setPropDict[gambinoTargets] == undefined || !(int(__setPropDict[gambinoTargets]) >= 2 && int(__setPropDict[gambinoTargets]) <= 9))
         {
            __setPropDict[gambinoTargets] = currentFrame;
            __setProp_gambinoTargets_mcPinballMachine_GambinoTargets_2();
         }
         if(__setPropDict[slotsTargets] == undefined || !(int(__setPropDict[slotsTargets]) >= 2 && int(__setPropDict[slotsTargets]) <= 9))
         {
            __setPropDict[slotsTargets] = currentFrame;
            __setProp_slotsTargets_mcPinballMachine_SlotsTargets_2();
         }
         if(__setPropDict[fishBumper] == undefined || !(int(__setPropDict[fishBumper]) >= 2 && int(__setPropDict[fishBumper]) <= 9))
         {
            __setPropDict[fishBumper] = currentFrame;
            __setProp_fishBumper_mcPinballMachine_FishBumper_2();
         }
         if(__setPropDict[helsonSaucerExit] == undefined || !(int(__setPropDict[helsonSaucerExit]) >= 2 && int(__setPropDict[helsonSaucerExit]) <= 9))
         {
            __setPropDict[helsonSaucerExit] = currentFrame;
            __setProp_helsonSaucerExit_mcPinballMachine_Eject_2();
         }
         if(__setPropDict[kicker_rc] == undefined || !(int(__setPropDict[kicker_rc]) >= 2 && int(__setPropDict[kicker_rc]) <= 9))
         {
            __setPropDict[kicker_rc] = currentFrame;
            __setProp_kicker_rc_mcPinballMachine_FlipperZone_2();
         }
         if(__setPropDict[kicker_ra] == undefined || !(int(__setPropDict[kicker_ra]) >= 2 && int(__setPropDict[kicker_ra]) <= 9))
         {
            __setPropDict[kicker_ra] = currentFrame;
            __setProp_kicker_ra_mcPinballMachine_Arena_2();
         }
         if(__setPropDict[arenaBumper0] == undefined || !(int(__setPropDict[arenaBumper0]) >= 2 && int(__setPropDict[arenaBumper0]) <= 9))
         {
            __setPropDict[arenaBumper0] = currentFrame;
            __setProp_arenaBumper0_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[zurgTarget] == undefined || !(int(__setPropDict[zurgTarget]) >= 2 && int(__setPropDict[zurgTarget]) <= 9))
         {
            __setPropDict[zurgTarget] = currentFrame;
            __setProp_zurgTarget_mcPinballMachine_Zurg_2();
         }
         if(__setPropDict[arenaBumper1] == undefined || !(int(__setPropDict[arenaBumper1]) >= 2 && int(__setPropDict[arenaBumper1]) <= 9))
         {
            __setPropDict[arenaBumper1] = currentFrame;
            __setProp_arenaBumper1_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[__id3_] == undefined || !(int(__setPropDict[__id3_]) >= 2 && int(__setPropDict[__id3_]) <= 9))
         {
            __setPropDict[__id3_] = currentFrame;
            __setProp___id3__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[voteTargets] == undefined || !(int(__setPropDict[voteTargets]) >= 2 && int(__setPropDict[voteTargets]) <= 9))
         {
            __setPropDict[voteTargets] = currentFrame;
            __setProp_voteTargets_mcPinballMachine_VoteTargets_2();
         }
         if(__setPropDict[gift10] == undefined || !(int(__setPropDict[gift10]) >= 2 && int(__setPropDict[gift10]) <= 9))
         {
            __setPropDict[gift10] = currentFrame;
            __setProp_gift10_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift12] == undefined || !(int(__setPropDict[gift12]) >= 2 && int(__setPropDict[gift12]) <= 9))
         {
            __setPropDict[gift12] = currentFrame;
            __setProp_gift12_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift13] == undefined || !(int(__setPropDict[gift13]) >= 2 && int(__setPropDict[gift13]) <= 9))
         {
            __setPropDict[gift13] = currentFrame;
            __setProp_gift13_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift11] == undefined || !(int(__setPropDict[gift11]) >= 2 && int(__setPropDict[gift11]) <= 9))
         {
            __setPropDict[gift11] = currentFrame;
            __setProp_gift11_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[arenaBumper2] == undefined || !(int(__setPropDict[arenaBumper2]) >= 2 && int(__setPropDict[arenaBumper2]) <= 9))
         {
            __setPropDict[arenaBumper2] = currentFrame;
            __setProp_arenaBumper2_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[__id0_] == undefined || !(int(__setPropDict[__id0_]) >= 2 && int(__setPropDict[__id0_]) <= 9))
         {
            __setPropDict[__id0_] = currentFrame;
            __setProp___id0__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[gift2] == undefined || !(int(__setPropDict[gift2]) >= 2 && int(__setPropDict[gift2]) <= 9))
         {
            __setPropDict[gift2] = currentFrame;
            __setProp_gift2_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift6] == undefined || !(int(__setPropDict[gift6]) >= 2 && int(__setPropDict[gift6]) <= 9))
         {
            __setPropDict[gift6] = currentFrame;
            __setProp_gift6_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[rockpuppyTarget] == undefined || !(int(__setPropDict[rockpuppyTarget]) >= 2 && int(__setPropDict[rockpuppyTarget]) <= 9))
         {
            __setPropDict[rockpuppyTarget] = currentFrame;
            __setProp_rockpuppyTarget_mcPinballMachine_RockPuppy_2();
         }
         if(__setPropDict[__id2_] == undefined || !(int(__setPropDict[__id2_]) >= 2 && int(__setPropDict[__id2_]) <= 9))
         {
            __setPropDict[__id2_] = currentFrame;
            __setProp___id2__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[loganSaucer] == undefined || !(int(__setPropDict[loganSaucer]) >= 2 && int(__setPropDict[loganSaucer]) <= 9))
         {
            __setPropDict[loganSaucer] = currentFrame;
            __setProp_loganSaucer_mcPinballMachine_LoganSaucer_2();
         }
         if(__setPropDict[bot2Target] == undefined || !(int(__setPropDict[bot2Target]) >= 2 && int(__setPropDict[bot2Target]) <= 9))
         {
            __setPropDict[bot2Target] = currentFrame;
            __setProp_bot2Target_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[kicker_la] == undefined || !(int(__setPropDict[kicker_la]) >= 2 && int(__setPropDict[kicker_la]) <= 9))
         {
            __setPropDict[kicker_la] = currentFrame;
            __setProp_kicker_la_mcPinballMachine_Arena_2();
         }
         if(__setPropDict[__id4_] == undefined || !(int(__setPropDict[__id4_]) >= 2 && int(__setPropDict[__id4_]) <= 9))
         {
            __setPropDict[__id4_] = currentFrame;
            __setProp___id4__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[__id5_] == undefined || !(int(__setPropDict[__id5_]) >= 2 && int(__setPropDict[__id5_]) <= 9))
         {
            __setPropDict[__id5_] = currentFrame;
            __setProp___id5__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[gift3] == undefined || !(int(__setPropDict[gift3]) >= 2 && int(__setPropDict[gift3]) <= 9))
         {
            __setPropDict[gift3] = currentFrame;
            __setProp_gift3_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift7] == undefined || !(int(__setPropDict[gift7]) >= 2 && int(__setPropDict[gift7]) <= 9))
         {
            __setPropDict[gift7] = currentFrame;
            __setProp_gift7_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[bot1Target] == undefined || !(int(__setPropDict[bot1Target]) >= 2 && int(__setPropDict[bot1Target]) <= 9))
         {
            __setPropDict[bot1Target] = currentFrame;
            __setProp_bot1Target_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[grunnyTargets] == undefined || !(int(__setPropDict[grunnyTargets]) >= 2 && int(__setPropDict[grunnyTargets]) <= 9))
         {
            __setPropDict[grunnyTargets] = currentFrame;
            __setProp_grunnyTargets_mcPinballMachine_GrunnyTargets_2();
         }
         if(__setPropDict[safetySwitch] == undefined || !(int(__setPropDict[safetySwitch]) >= 2 && int(__setPropDict[safetySwitch]) <= 9))
         {
            __setPropDict[safetySwitch] = currentFrame;
            __setProp_safetySwitch_mcPinballMachine_LaunchAlley_2();
         }
         if(__setPropDict[gift4] == undefined || !(int(__setPropDict[gift4]) >= 2 && int(__setPropDict[gift4]) <= 9))
         {
            __setPropDict[gift4] = currentFrame;
            __setProp_gift4_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[__id1_] == undefined || !(int(__setPropDict[__id1_]) >= 2 && int(__setPropDict[__id1_]) <= 9))
         {
            __setPropDict[__id1_] = currentFrame;
            __setProp___id1__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[tradeTargets] == undefined || !(int(__setPropDict[tradeTargets]) >= 2 && int(__setPropDict[tradeTargets]) <= 9))
         {
            __setPropDict[tradeTargets] = currentFrame;
            __setProp_tradeTargets_mcPinballMachine_TradeTargets_2();
         }
         if(__setPropDict[gift9] == undefined || !(int(__setPropDict[gift9]) >= 2 && int(__setPropDict[gift9]) <= 9))
         {
            __setPropDict[gift9] = currentFrame;
            __setProp_gift9_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift8] == undefined || !(int(__setPropDict[gift8]) >= 2 && int(__setPropDict[gift8]) <= 9))
         {
            __setPropDict[gift8] = currentFrame;
            __setProp_gift8_mcPinballMachine_Gifts_2();
         }
      }
      
      internal function frame6() : *
      {
         if(__setPropDict[kicker_lc] == undefined || !(int(__setPropDict[kicker_lc]) >= 2 && int(__setPropDict[kicker_lc]) <= 9))
         {
            __setPropDict[kicker_lc] = currentFrame;
            __setProp_kicker_lc_mcPinballMachine_FlipperZone_2();
         }
         if(__setPropDict[gift5] == undefined || !(int(__setPropDict[gift5]) >= 2 && int(__setPropDict[gift5]) <= 9))
         {
            __setPropDict[gift5] = currentFrame;
            __setProp_gift5_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift1] == undefined || !(int(__setPropDict[gift1]) >= 2 && int(__setPropDict[gift1]) <= 9))
         {
            __setPropDict[gift1] = currentFrame;
            __setProp_gift1_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[fishTargets] == undefined || !(int(__setPropDict[fishTargets]) >= 2 && int(__setPropDict[fishTargets]) <= 9))
         {
            __setPropDict[fishTargets] = currentFrame;
            __setProp_fishTargets_mcPinballMachine_FishTargets_2();
         }
         if(__setPropDict[guildTarget] == undefined || !(int(__setPropDict[guildTarget]) >= 2 && int(__setPropDict[guildTarget]) <= 9))
         {
            __setPropDict[guildTarget] = currentFrame;
            __setProp_guildTarget_mcPinballMachine_GuildTarget_2();
         }
         if(__setPropDict[gift15] == undefined || !(int(__setPropDict[gift15]) >= 2 && int(__setPropDict[gift15]) <= 9))
         {
            __setPropDict[gift15] = currentFrame;
            __setProp_gift15_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift14] == undefined || !(int(__setPropDict[gift14]) >= 2 && int(__setPropDict[gift14]) <= 9))
         {
            __setPropDict[gift14] = currentFrame;
            __setProp_gift14_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[cowTarget] == undefined || !(int(__setPropDict[cowTarget]) >= 2 && int(__setPropDict[cowTarget]) <= 9))
         {
            __setPropDict[cowTarget] = currentFrame;
            __setProp_cowTarget_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[gambinoSaucer] == undefined || !(int(__setPropDict[gambinoSaucer]) >= 2 && int(__setPropDict[gambinoSaucer]) <= 9))
         {
            __setPropDict[gambinoSaucer] = currentFrame;
            __setProp_gambinoSaucer_mcPinballMachine_GambinoSaucer_2();
         }
         if(__setPropDict[gambinoTargets] == undefined || !(int(__setPropDict[gambinoTargets]) >= 2 && int(__setPropDict[gambinoTargets]) <= 9))
         {
            __setPropDict[gambinoTargets] = currentFrame;
            __setProp_gambinoTargets_mcPinballMachine_GambinoTargets_2();
         }
         if(__setPropDict[slotsTargets] == undefined || !(int(__setPropDict[slotsTargets]) >= 2 && int(__setPropDict[slotsTargets]) <= 9))
         {
            __setPropDict[slotsTargets] = currentFrame;
            __setProp_slotsTargets_mcPinballMachine_SlotsTargets_2();
         }
         if(__setPropDict[fishBumper] == undefined || !(int(__setPropDict[fishBumper]) >= 2 && int(__setPropDict[fishBumper]) <= 9))
         {
            __setPropDict[fishBumper] = currentFrame;
            __setProp_fishBumper_mcPinballMachine_FishBumper_2();
         }
         if(__setPropDict[helsonSaucerExit] == undefined || !(int(__setPropDict[helsonSaucerExit]) >= 2 && int(__setPropDict[helsonSaucerExit]) <= 9))
         {
            __setPropDict[helsonSaucerExit] = currentFrame;
            __setProp_helsonSaucerExit_mcPinballMachine_Eject_2();
         }
         if(__setPropDict[kicker_rc] == undefined || !(int(__setPropDict[kicker_rc]) >= 2 && int(__setPropDict[kicker_rc]) <= 9))
         {
            __setPropDict[kicker_rc] = currentFrame;
            __setProp_kicker_rc_mcPinballMachine_FlipperZone_2();
         }
         if(__setPropDict[kicker_ra] == undefined || !(int(__setPropDict[kicker_ra]) >= 2 && int(__setPropDict[kicker_ra]) <= 9))
         {
            __setPropDict[kicker_ra] = currentFrame;
            __setProp_kicker_ra_mcPinballMachine_Arena_2();
         }
         if(__setPropDict[arenaBumper0] == undefined || !(int(__setPropDict[arenaBumper0]) >= 2 && int(__setPropDict[arenaBumper0]) <= 9))
         {
            __setPropDict[arenaBumper0] = currentFrame;
            __setProp_arenaBumper0_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[zurgTarget] == undefined || !(int(__setPropDict[zurgTarget]) >= 2 && int(__setPropDict[zurgTarget]) <= 9))
         {
            __setPropDict[zurgTarget] = currentFrame;
            __setProp_zurgTarget_mcPinballMachine_Zurg_2();
         }
         if(__setPropDict[arenaBumper1] == undefined || !(int(__setPropDict[arenaBumper1]) >= 2 && int(__setPropDict[arenaBumper1]) <= 9))
         {
            __setPropDict[arenaBumper1] = currentFrame;
            __setProp_arenaBumper1_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[__id3_] == undefined || !(int(__setPropDict[__id3_]) >= 2 && int(__setPropDict[__id3_]) <= 9))
         {
            __setPropDict[__id3_] = currentFrame;
            __setProp___id3__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[voteTargets] == undefined || !(int(__setPropDict[voteTargets]) >= 2 && int(__setPropDict[voteTargets]) <= 9))
         {
            __setPropDict[voteTargets] = currentFrame;
            __setProp_voteTargets_mcPinballMachine_VoteTargets_2();
         }
         if(__setPropDict[gift10] == undefined || !(int(__setPropDict[gift10]) >= 2 && int(__setPropDict[gift10]) <= 9))
         {
            __setPropDict[gift10] = currentFrame;
            __setProp_gift10_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift12] == undefined || !(int(__setPropDict[gift12]) >= 2 && int(__setPropDict[gift12]) <= 9))
         {
            __setPropDict[gift12] = currentFrame;
            __setProp_gift12_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift13] == undefined || !(int(__setPropDict[gift13]) >= 2 && int(__setPropDict[gift13]) <= 9))
         {
            __setPropDict[gift13] = currentFrame;
            __setProp_gift13_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift11] == undefined || !(int(__setPropDict[gift11]) >= 2 && int(__setPropDict[gift11]) <= 9))
         {
            __setPropDict[gift11] = currentFrame;
            __setProp_gift11_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[arenaBumper2] == undefined || !(int(__setPropDict[arenaBumper2]) >= 2 && int(__setPropDict[arenaBumper2]) <= 9))
         {
            __setPropDict[arenaBumper2] = currentFrame;
            __setProp_arenaBumper2_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[__id0_] == undefined || !(int(__setPropDict[__id0_]) >= 2 && int(__setPropDict[__id0_]) <= 9))
         {
            __setPropDict[__id0_] = currentFrame;
            __setProp___id0__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[gift2] == undefined || !(int(__setPropDict[gift2]) >= 2 && int(__setPropDict[gift2]) <= 9))
         {
            __setPropDict[gift2] = currentFrame;
            __setProp_gift2_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift6] == undefined || !(int(__setPropDict[gift6]) >= 2 && int(__setPropDict[gift6]) <= 9))
         {
            __setPropDict[gift6] = currentFrame;
            __setProp_gift6_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[rockpuppyTarget] == undefined || !(int(__setPropDict[rockpuppyTarget]) >= 2 && int(__setPropDict[rockpuppyTarget]) <= 9))
         {
            __setPropDict[rockpuppyTarget] = currentFrame;
            __setProp_rockpuppyTarget_mcPinballMachine_RockPuppy_2();
         }
         if(__setPropDict[__id2_] == undefined || !(int(__setPropDict[__id2_]) >= 2 && int(__setPropDict[__id2_]) <= 9))
         {
            __setPropDict[__id2_] = currentFrame;
            __setProp___id2__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[loganSaucer] == undefined || !(int(__setPropDict[loganSaucer]) >= 2 && int(__setPropDict[loganSaucer]) <= 9))
         {
            __setPropDict[loganSaucer] = currentFrame;
            __setProp_loganSaucer_mcPinballMachine_LoganSaucer_2();
         }
         if(__setPropDict[bot2Target] == undefined || !(int(__setPropDict[bot2Target]) >= 2 && int(__setPropDict[bot2Target]) <= 9))
         {
            __setPropDict[bot2Target] = currentFrame;
            __setProp_bot2Target_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[kicker_la] == undefined || !(int(__setPropDict[kicker_la]) >= 2 && int(__setPropDict[kicker_la]) <= 9))
         {
            __setPropDict[kicker_la] = currentFrame;
            __setProp_kicker_la_mcPinballMachine_Arena_2();
         }
         if(__setPropDict[__id4_] == undefined || !(int(__setPropDict[__id4_]) >= 2 && int(__setPropDict[__id4_]) <= 9))
         {
            __setPropDict[__id4_] = currentFrame;
            __setProp___id4__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[__id5_] == undefined || !(int(__setPropDict[__id5_]) >= 2 && int(__setPropDict[__id5_]) <= 9))
         {
            __setPropDict[__id5_] = currentFrame;
            __setProp___id5__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[gift3] == undefined || !(int(__setPropDict[gift3]) >= 2 && int(__setPropDict[gift3]) <= 9))
         {
            __setPropDict[gift3] = currentFrame;
            __setProp_gift3_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift7] == undefined || !(int(__setPropDict[gift7]) >= 2 && int(__setPropDict[gift7]) <= 9))
         {
            __setPropDict[gift7] = currentFrame;
            __setProp_gift7_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[bot1Target] == undefined || !(int(__setPropDict[bot1Target]) >= 2 && int(__setPropDict[bot1Target]) <= 9))
         {
            __setPropDict[bot1Target] = currentFrame;
            __setProp_bot1Target_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[grunnyTargets] == undefined || !(int(__setPropDict[grunnyTargets]) >= 2 && int(__setPropDict[grunnyTargets]) <= 9))
         {
            __setPropDict[grunnyTargets] = currentFrame;
            __setProp_grunnyTargets_mcPinballMachine_GrunnyTargets_2();
         }
         if(__setPropDict[safetySwitch] == undefined || !(int(__setPropDict[safetySwitch]) >= 2 && int(__setPropDict[safetySwitch]) <= 9))
         {
            __setPropDict[safetySwitch] = currentFrame;
            __setProp_safetySwitch_mcPinballMachine_LaunchAlley_2();
         }
         if(__setPropDict[gift4] == undefined || !(int(__setPropDict[gift4]) >= 2 && int(__setPropDict[gift4]) <= 9))
         {
            __setPropDict[gift4] = currentFrame;
            __setProp_gift4_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[__id1_] == undefined || !(int(__setPropDict[__id1_]) >= 2 && int(__setPropDict[__id1_]) <= 9))
         {
            __setPropDict[__id1_] = currentFrame;
            __setProp___id1__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[tradeTargets] == undefined || !(int(__setPropDict[tradeTargets]) >= 2 && int(__setPropDict[tradeTargets]) <= 9))
         {
            __setPropDict[tradeTargets] = currentFrame;
            __setProp_tradeTargets_mcPinballMachine_TradeTargets_2();
         }
         if(__setPropDict[gift9] == undefined || !(int(__setPropDict[gift9]) >= 2 && int(__setPropDict[gift9]) <= 9))
         {
            __setPropDict[gift9] = currentFrame;
            __setProp_gift9_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift8] == undefined || !(int(__setPropDict[gift8]) >= 2 && int(__setPropDict[gift8]) <= 9))
         {
            __setPropDict[gift8] = currentFrame;
            __setProp_gift8_mcPinballMachine_Gifts_2();
         }
      }
      
      internal function frame8() : *
      {
         if(__setPropDict[kicker_lc] == undefined || !(int(__setPropDict[kicker_lc]) >= 2 && int(__setPropDict[kicker_lc]) <= 9))
         {
            __setPropDict[kicker_lc] = currentFrame;
            __setProp_kicker_lc_mcPinballMachine_FlipperZone_2();
         }
         if(__setPropDict[gift5] == undefined || !(int(__setPropDict[gift5]) >= 2 && int(__setPropDict[gift5]) <= 9))
         {
            __setPropDict[gift5] = currentFrame;
            __setProp_gift5_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift1] == undefined || !(int(__setPropDict[gift1]) >= 2 && int(__setPropDict[gift1]) <= 9))
         {
            __setPropDict[gift1] = currentFrame;
            __setProp_gift1_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[fishTargets] == undefined || !(int(__setPropDict[fishTargets]) >= 2 && int(__setPropDict[fishTargets]) <= 9))
         {
            __setPropDict[fishTargets] = currentFrame;
            __setProp_fishTargets_mcPinballMachine_FishTargets_2();
         }
         if(__setPropDict[guildTarget] == undefined || !(int(__setPropDict[guildTarget]) >= 2 && int(__setPropDict[guildTarget]) <= 9))
         {
            __setPropDict[guildTarget] = currentFrame;
            __setProp_guildTarget_mcPinballMachine_GuildTarget_2();
         }
         if(__setPropDict[gift15] == undefined || !(int(__setPropDict[gift15]) >= 2 && int(__setPropDict[gift15]) <= 9))
         {
            __setPropDict[gift15] = currentFrame;
            __setProp_gift15_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift14] == undefined || !(int(__setPropDict[gift14]) >= 2 && int(__setPropDict[gift14]) <= 9))
         {
            __setPropDict[gift14] = currentFrame;
            __setProp_gift14_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[cowTarget] == undefined || !(int(__setPropDict[cowTarget]) >= 2 && int(__setPropDict[cowTarget]) <= 9))
         {
            __setPropDict[cowTarget] = currentFrame;
            __setProp_cowTarget_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[gambinoSaucer] == undefined || !(int(__setPropDict[gambinoSaucer]) >= 2 && int(__setPropDict[gambinoSaucer]) <= 9))
         {
            __setPropDict[gambinoSaucer] = currentFrame;
            __setProp_gambinoSaucer_mcPinballMachine_GambinoSaucer_2();
         }
         if(__setPropDict[gambinoTargets] == undefined || !(int(__setPropDict[gambinoTargets]) >= 2 && int(__setPropDict[gambinoTargets]) <= 9))
         {
            __setPropDict[gambinoTargets] = currentFrame;
            __setProp_gambinoTargets_mcPinballMachine_GambinoTargets_2();
         }
         if(__setPropDict[slotsTargets] == undefined || !(int(__setPropDict[slotsTargets]) >= 2 && int(__setPropDict[slotsTargets]) <= 9))
         {
            __setPropDict[slotsTargets] = currentFrame;
            __setProp_slotsTargets_mcPinballMachine_SlotsTargets_2();
         }
         if(__setPropDict[fishBumper] == undefined || !(int(__setPropDict[fishBumper]) >= 2 && int(__setPropDict[fishBumper]) <= 9))
         {
            __setPropDict[fishBumper] = currentFrame;
            __setProp_fishBumper_mcPinballMachine_FishBumper_2();
         }
         if(__setPropDict[helsonSaucerExit] == undefined || !(int(__setPropDict[helsonSaucerExit]) >= 2 && int(__setPropDict[helsonSaucerExit]) <= 9))
         {
            __setPropDict[helsonSaucerExit] = currentFrame;
            __setProp_helsonSaucerExit_mcPinballMachine_Eject_2();
         }
         if(__setPropDict[kicker_rc] == undefined || !(int(__setPropDict[kicker_rc]) >= 2 && int(__setPropDict[kicker_rc]) <= 9))
         {
            __setPropDict[kicker_rc] = currentFrame;
            __setProp_kicker_rc_mcPinballMachine_FlipperZone_2();
         }
         if(__setPropDict[kicker_ra] == undefined || !(int(__setPropDict[kicker_ra]) >= 2 && int(__setPropDict[kicker_ra]) <= 9))
         {
            __setPropDict[kicker_ra] = currentFrame;
            __setProp_kicker_ra_mcPinballMachine_Arena_2();
         }
         if(__setPropDict[arenaBumper0] == undefined || !(int(__setPropDict[arenaBumper0]) >= 2 && int(__setPropDict[arenaBumper0]) <= 9))
         {
            __setPropDict[arenaBumper0] = currentFrame;
            __setProp_arenaBumper0_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[zurgTarget] == undefined || !(int(__setPropDict[zurgTarget]) >= 2 && int(__setPropDict[zurgTarget]) <= 9))
         {
            __setPropDict[zurgTarget] = currentFrame;
            __setProp_zurgTarget_mcPinballMachine_Zurg_2();
         }
         if(__setPropDict[arenaBumper1] == undefined || !(int(__setPropDict[arenaBumper1]) >= 2 && int(__setPropDict[arenaBumper1]) <= 9))
         {
            __setPropDict[arenaBumper1] = currentFrame;
            __setProp_arenaBumper1_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[__id3_] == undefined || !(int(__setPropDict[__id3_]) >= 2 && int(__setPropDict[__id3_]) <= 9))
         {
            __setPropDict[__id3_] = currentFrame;
            __setProp___id3__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[voteTargets] == undefined || !(int(__setPropDict[voteTargets]) >= 2 && int(__setPropDict[voteTargets]) <= 9))
         {
            __setPropDict[voteTargets] = currentFrame;
            __setProp_voteTargets_mcPinballMachine_VoteTargets_2();
         }
         if(__setPropDict[gift10] == undefined || !(int(__setPropDict[gift10]) >= 2 && int(__setPropDict[gift10]) <= 9))
         {
            __setPropDict[gift10] = currentFrame;
            __setProp_gift10_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift12] == undefined || !(int(__setPropDict[gift12]) >= 2 && int(__setPropDict[gift12]) <= 9))
         {
            __setPropDict[gift12] = currentFrame;
            __setProp_gift12_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift13] == undefined || !(int(__setPropDict[gift13]) >= 2 && int(__setPropDict[gift13]) <= 9))
         {
            __setPropDict[gift13] = currentFrame;
            __setProp_gift13_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift11] == undefined || !(int(__setPropDict[gift11]) >= 2 && int(__setPropDict[gift11]) <= 9))
         {
            __setPropDict[gift11] = currentFrame;
            __setProp_gift11_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[arenaBumper2] == undefined || !(int(__setPropDict[arenaBumper2]) >= 2 && int(__setPropDict[arenaBumper2]) <= 9))
         {
            __setPropDict[arenaBumper2] = currentFrame;
            __setProp_arenaBumper2_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[__id0_] == undefined || !(int(__setPropDict[__id0_]) >= 2 && int(__setPropDict[__id0_]) <= 9))
         {
            __setPropDict[__id0_] = currentFrame;
            __setProp___id0__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[gift2] == undefined || !(int(__setPropDict[gift2]) >= 2 && int(__setPropDict[gift2]) <= 9))
         {
            __setPropDict[gift2] = currentFrame;
            __setProp_gift2_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift6] == undefined || !(int(__setPropDict[gift6]) >= 2 && int(__setPropDict[gift6]) <= 9))
         {
            __setPropDict[gift6] = currentFrame;
            __setProp_gift6_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[rockpuppyTarget] == undefined || !(int(__setPropDict[rockpuppyTarget]) >= 2 && int(__setPropDict[rockpuppyTarget]) <= 9))
         {
            __setPropDict[rockpuppyTarget] = currentFrame;
            __setProp_rockpuppyTarget_mcPinballMachine_RockPuppy_2();
         }
         if(__setPropDict[__id2_] == undefined || !(int(__setPropDict[__id2_]) >= 2 && int(__setPropDict[__id2_]) <= 9))
         {
            __setPropDict[__id2_] = currentFrame;
            __setProp___id2__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[loganSaucer] == undefined || !(int(__setPropDict[loganSaucer]) >= 2 && int(__setPropDict[loganSaucer]) <= 9))
         {
            __setPropDict[loganSaucer] = currentFrame;
            __setProp_loganSaucer_mcPinballMachine_LoganSaucer_2();
         }
         if(__setPropDict[bot2Target] == undefined || !(int(__setPropDict[bot2Target]) >= 2 && int(__setPropDict[bot2Target]) <= 9))
         {
            __setPropDict[bot2Target] = currentFrame;
            __setProp_bot2Target_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[kicker_la] == undefined || !(int(__setPropDict[kicker_la]) >= 2 && int(__setPropDict[kicker_la]) <= 9))
         {
            __setPropDict[kicker_la] = currentFrame;
            __setProp_kicker_la_mcPinballMachine_Arena_2();
         }
         if(__setPropDict[__id4_] == undefined || !(int(__setPropDict[__id4_]) >= 2 && int(__setPropDict[__id4_]) <= 9))
         {
            __setPropDict[__id4_] = currentFrame;
            __setProp___id4__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[__id5_] == undefined || !(int(__setPropDict[__id5_]) >= 2 && int(__setPropDict[__id5_]) <= 9))
         {
            __setPropDict[__id5_] = currentFrame;
            __setProp___id5__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[gift3] == undefined || !(int(__setPropDict[gift3]) >= 2 && int(__setPropDict[gift3]) <= 9))
         {
            __setPropDict[gift3] = currentFrame;
            __setProp_gift3_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift7] == undefined || !(int(__setPropDict[gift7]) >= 2 && int(__setPropDict[gift7]) <= 9))
         {
            __setPropDict[gift7] = currentFrame;
            __setProp_gift7_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[bot1Target] == undefined || !(int(__setPropDict[bot1Target]) >= 2 && int(__setPropDict[bot1Target]) <= 9))
         {
            __setPropDict[bot1Target] = currentFrame;
            __setProp_bot1Target_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[grunnyTargets] == undefined || !(int(__setPropDict[grunnyTargets]) >= 2 && int(__setPropDict[grunnyTargets]) <= 9))
         {
            __setPropDict[grunnyTargets] = currentFrame;
            __setProp_grunnyTargets_mcPinballMachine_GrunnyTargets_2();
         }
         if(__setPropDict[safetySwitch] == undefined || !(int(__setPropDict[safetySwitch]) >= 2 && int(__setPropDict[safetySwitch]) <= 9))
         {
            __setPropDict[safetySwitch] = currentFrame;
            __setProp_safetySwitch_mcPinballMachine_LaunchAlley_2();
         }
         if(__setPropDict[gift4] == undefined || !(int(__setPropDict[gift4]) >= 2 && int(__setPropDict[gift4]) <= 9))
         {
            __setPropDict[gift4] = currentFrame;
            __setProp_gift4_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[__id1_] == undefined || !(int(__setPropDict[__id1_]) >= 2 && int(__setPropDict[__id1_]) <= 9))
         {
            __setPropDict[__id1_] = currentFrame;
            __setProp___id1__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[tradeTargets] == undefined || !(int(__setPropDict[tradeTargets]) >= 2 && int(__setPropDict[tradeTargets]) <= 9))
         {
            __setPropDict[tradeTargets] = currentFrame;
            __setProp_tradeTargets_mcPinballMachine_TradeTargets_2();
         }
         if(__setPropDict[gift9] == undefined || !(int(__setPropDict[gift9]) >= 2 && int(__setPropDict[gift9]) <= 9))
         {
            __setPropDict[gift9] = currentFrame;
            __setProp_gift9_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift8] == undefined || !(int(__setPropDict[gift8]) >= 2 && int(__setPropDict[gift8]) <= 9))
         {
            __setPropDict[gift8] = currentFrame;
            __setProp_gift8_mcPinballMachine_Gifts_2();
         }
      }
      
      internal function frame9() : *
      {
         if(__setPropDict[kicker_lc] == undefined || !(int(__setPropDict[kicker_lc]) >= 2 && int(__setPropDict[kicker_lc]) <= 9))
         {
            __setPropDict[kicker_lc] = currentFrame;
            __setProp_kicker_lc_mcPinballMachine_FlipperZone_2();
         }
         if(__setPropDict[gift5] == undefined || !(int(__setPropDict[gift5]) >= 2 && int(__setPropDict[gift5]) <= 9))
         {
            __setPropDict[gift5] = currentFrame;
            __setProp_gift5_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift1] == undefined || !(int(__setPropDict[gift1]) >= 2 && int(__setPropDict[gift1]) <= 9))
         {
            __setPropDict[gift1] = currentFrame;
            __setProp_gift1_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[fishTargets] == undefined || !(int(__setPropDict[fishTargets]) >= 2 && int(__setPropDict[fishTargets]) <= 9))
         {
            __setPropDict[fishTargets] = currentFrame;
            __setProp_fishTargets_mcPinballMachine_FishTargets_2();
         }
         if(__setPropDict[guildTarget] == undefined || !(int(__setPropDict[guildTarget]) >= 2 && int(__setPropDict[guildTarget]) <= 9))
         {
            __setPropDict[guildTarget] = currentFrame;
            __setProp_guildTarget_mcPinballMachine_GuildTarget_2();
         }
         if(__setPropDict[gift15] == undefined || !(int(__setPropDict[gift15]) >= 2 && int(__setPropDict[gift15]) <= 9))
         {
            __setPropDict[gift15] = currentFrame;
            __setProp_gift15_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift14] == undefined || !(int(__setPropDict[gift14]) >= 2 && int(__setPropDict[gift14]) <= 9))
         {
            __setPropDict[gift14] = currentFrame;
            __setProp_gift14_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[cowTarget] == undefined || !(int(__setPropDict[cowTarget]) >= 2 && int(__setPropDict[cowTarget]) <= 9))
         {
            __setPropDict[cowTarget] = currentFrame;
            __setProp_cowTarget_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[gambinoSaucer] == undefined || !(int(__setPropDict[gambinoSaucer]) >= 2 && int(__setPropDict[gambinoSaucer]) <= 9))
         {
            __setPropDict[gambinoSaucer] = currentFrame;
            __setProp_gambinoSaucer_mcPinballMachine_GambinoSaucer_2();
         }
         if(__setPropDict[gambinoTargets] == undefined || !(int(__setPropDict[gambinoTargets]) >= 2 && int(__setPropDict[gambinoTargets]) <= 9))
         {
            __setPropDict[gambinoTargets] = currentFrame;
            __setProp_gambinoTargets_mcPinballMachine_GambinoTargets_2();
         }
         if(__setPropDict[slotsTargets] == undefined || !(int(__setPropDict[slotsTargets]) >= 2 && int(__setPropDict[slotsTargets]) <= 9))
         {
            __setPropDict[slotsTargets] = currentFrame;
            __setProp_slotsTargets_mcPinballMachine_SlotsTargets_2();
         }
         if(__setPropDict[fishBumper] == undefined || !(int(__setPropDict[fishBumper]) >= 2 && int(__setPropDict[fishBumper]) <= 9))
         {
            __setPropDict[fishBumper] = currentFrame;
            __setProp_fishBumper_mcPinballMachine_FishBumper_2();
         }
         if(__setPropDict[helsonSaucerExit] == undefined || !(int(__setPropDict[helsonSaucerExit]) >= 2 && int(__setPropDict[helsonSaucerExit]) <= 9))
         {
            __setPropDict[helsonSaucerExit] = currentFrame;
            __setProp_helsonSaucerExit_mcPinballMachine_Eject_2();
         }
         if(__setPropDict[kicker_rc] == undefined || !(int(__setPropDict[kicker_rc]) >= 2 && int(__setPropDict[kicker_rc]) <= 9))
         {
            __setPropDict[kicker_rc] = currentFrame;
            __setProp_kicker_rc_mcPinballMachine_FlipperZone_2();
         }
         if(__setPropDict[kicker_ra] == undefined || !(int(__setPropDict[kicker_ra]) >= 2 && int(__setPropDict[kicker_ra]) <= 9))
         {
            __setPropDict[kicker_ra] = currentFrame;
            __setProp_kicker_ra_mcPinballMachine_Arena_2();
         }
         if(__setPropDict[arenaBumper0] == undefined || !(int(__setPropDict[arenaBumper0]) >= 2 && int(__setPropDict[arenaBumper0]) <= 9))
         {
            __setPropDict[arenaBumper0] = currentFrame;
            __setProp_arenaBumper0_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[zurgTarget] == undefined || !(int(__setPropDict[zurgTarget]) >= 2 && int(__setPropDict[zurgTarget]) <= 9))
         {
            __setPropDict[zurgTarget] = currentFrame;
            __setProp_zurgTarget_mcPinballMachine_Zurg_2();
         }
         if(__setPropDict[arenaBumper1] == undefined || !(int(__setPropDict[arenaBumper1]) >= 2 && int(__setPropDict[arenaBumper1]) <= 9))
         {
            __setPropDict[arenaBumper1] = currentFrame;
            __setProp_arenaBumper1_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[__id3_] == undefined || !(int(__setPropDict[__id3_]) >= 2 && int(__setPropDict[__id3_]) <= 9))
         {
            __setPropDict[__id3_] = currentFrame;
            __setProp___id3__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[voteTargets] == undefined || !(int(__setPropDict[voteTargets]) >= 2 && int(__setPropDict[voteTargets]) <= 9))
         {
            __setPropDict[voteTargets] = currentFrame;
            __setProp_voteTargets_mcPinballMachine_VoteTargets_2();
         }
         if(__setPropDict[gift10] == undefined || !(int(__setPropDict[gift10]) >= 2 && int(__setPropDict[gift10]) <= 9))
         {
            __setPropDict[gift10] = currentFrame;
            __setProp_gift10_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift12] == undefined || !(int(__setPropDict[gift12]) >= 2 && int(__setPropDict[gift12]) <= 9))
         {
            __setPropDict[gift12] = currentFrame;
            __setProp_gift12_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift13] == undefined || !(int(__setPropDict[gift13]) >= 2 && int(__setPropDict[gift13]) <= 9))
         {
            __setPropDict[gift13] = currentFrame;
            __setProp_gift13_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift11] == undefined || !(int(__setPropDict[gift11]) >= 2 && int(__setPropDict[gift11]) <= 9))
         {
            __setPropDict[gift11] = currentFrame;
            __setProp_gift11_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[arenaBumper2] == undefined || !(int(__setPropDict[arenaBumper2]) >= 2 && int(__setPropDict[arenaBumper2]) <= 9))
         {
            __setPropDict[arenaBumper2] = currentFrame;
            __setProp_arenaBumper2_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[__id0_] == undefined || !(int(__setPropDict[__id0_]) >= 2 && int(__setPropDict[__id0_]) <= 9))
         {
            __setPropDict[__id0_] = currentFrame;
            __setProp___id0__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[gift2] == undefined || !(int(__setPropDict[gift2]) >= 2 && int(__setPropDict[gift2]) <= 9))
         {
            __setPropDict[gift2] = currentFrame;
            __setProp_gift2_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift6] == undefined || !(int(__setPropDict[gift6]) >= 2 && int(__setPropDict[gift6]) <= 9))
         {
            __setPropDict[gift6] = currentFrame;
            __setProp_gift6_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[rockpuppyTarget] == undefined || !(int(__setPropDict[rockpuppyTarget]) >= 2 && int(__setPropDict[rockpuppyTarget]) <= 9))
         {
            __setPropDict[rockpuppyTarget] = currentFrame;
            __setProp_rockpuppyTarget_mcPinballMachine_RockPuppy_2();
         }
         if(__setPropDict[__id2_] == undefined || !(int(__setPropDict[__id2_]) >= 2 && int(__setPropDict[__id2_]) <= 9))
         {
            __setPropDict[__id2_] = currentFrame;
            __setProp___id2__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[loganSaucer] == undefined || !(int(__setPropDict[loganSaucer]) >= 2 && int(__setPropDict[loganSaucer]) <= 9))
         {
            __setPropDict[loganSaucer] = currentFrame;
            __setProp_loganSaucer_mcPinballMachine_LoganSaucer_2();
         }
         if(__setPropDict[bot2Target] == undefined || !(int(__setPropDict[bot2Target]) >= 2 && int(__setPropDict[bot2Target]) <= 9))
         {
            __setPropDict[bot2Target] = currentFrame;
            __setProp_bot2Target_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[kicker_la] == undefined || !(int(__setPropDict[kicker_la]) >= 2 && int(__setPropDict[kicker_la]) <= 9))
         {
            __setPropDict[kicker_la] = currentFrame;
            __setProp_kicker_la_mcPinballMachine_Arena_2();
         }
         if(__setPropDict[__id4_] == undefined || !(int(__setPropDict[__id4_]) >= 2 && int(__setPropDict[__id4_]) <= 9))
         {
            __setPropDict[__id4_] = currentFrame;
            __setProp___id4__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[__id5_] == undefined || !(int(__setPropDict[__id5_]) >= 2 && int(__setPropDict[__id5_]) <= 9))
         {
            __setPropDict[__id5_] = currentFrame;
            __setProp___id5__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[gift3] == undefined || !(int(__setPropDict[gift3]) >= 2 && int(__setPropDict[gift3]) <= 9))
         {
            __setPropDict[gift3] = currentFrame;
            __setProp_gift3_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift7] == undefined || !(int(__setPropDict[gift7]) >= 2 && int(__setPropDict[gift7]) <= 9))
         {
            __setPropDict[gift7] = currentFrame;
            __setProp_gift7_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[bot1Target] == undefined || !(int(__setPropDict[bot1Target]) >= 2 && int(__setPropDict[bot1Target]) <= 9))
         {
            __setPropDict[bot1Target] = currentFrame;
            __setProp_bot1Target_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[grunnyTargets] == undefined || !(int(__setPropDict[grunnyTargets]) >= 2 && int(__setPropDict[grunnyTargets]) <= 9))
         {
            __setPropDict[grunnyTargets] = currentFrame;
            __setProp_grunnyTargets_mcPinballMachine_GrunnyTargets_2();
         }
         if(__setPropDict[safetySwitch] == undefined || !(int(__setPropDict[safetySwitch]) >= 2 && int(__setPropDict[safetySwitch]) <= 9))
         {
            __setPropDict[safetySwitch] = currentFrame;
            __setProp_safetySwitch_mcPinballMachine_LaunchAlley_2();
         }
         if(__setPropDict[gift4] == undefined || !(int(__setPropDict[gift4]) >= 2 && int(__setPropDict[gift4]) <= 9))
         {
            __setPropDict[gift4] = currentFrame;
            __setProp_gift4_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[__id1_] == undefined || !(int(__setPropDict[__id1_]) >= 2 && int(__setPropDict[__id1_]) <= 9))
         {
            __setPropDict[__id1_] = currentFrame;
            __setProp___id1__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[tradeTargets] == undefined || !(int(__setPropDict[tradeTargets]) >= 2 && int(__setPropDict[tradeTargets]) <= 9))
         {
            __setPropDict[tradeTargets] = currentFrame;
            __setProp_tradeTargets_mcPinballMachine_TradeTargets_2();
         }
         if(__setPropDict[gift9] == undefined || !(int(__setPropDict[gift9]) >= 2 && int(__setPropDict[gift9]) <= 9))
         {
            __setPropDict[gift9] = currentFrame;
            __setProp_gift9_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift8] == undefined || !(int(__setPropDict[gift8]) >= 2 && int(__setPropDict[gift8]) <= 9))
         {
            __setPropDict[gift8] = currentFrame;
            __setProp_gift8_mcPinballMachine_Gifts_2();
         }
         stop();
      }
      
      internal function __setProp___id4__mcPinballMachine_Shortcut_2() : *
      {
         try
         {
            __id4_["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         __id4_.__MyLocation = "table";
         __id4_.__OverDir = true;
         __id4_.__Power = 7;
         __id4_.__MySndEffect = "none";
         try
         {
            __id4_["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame7() : *
      {
         if(__setPropDict[kicker_lc] == undefined || !(int(__setPropDict[kicker_lc]) >= 2 && int(__setPropDict[kicker_lc]) <= 9))
         {
            __setPropDict[kicker_lc] = currentFrame;
            __setProp_kicker_lc_mcPinballMachine_FlipperZone_2();
         }
         if(__setPropDict[gift5] == undefined || !(int(__setPropDict[gift5]) >= 2 && int(__setPropDict[gift5]) <= 9))
         {
            __setPropDict[gift5] = currentFrame;
            __setProp_gift5_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift1] == undefined || !(int(__setPropDict[gift1]) >= 2 && int(__setPropDict[gift1]) <= 9))
         {
            __setPropDict[gift1] = currentFrame;
            __setProp_gift1_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[fishTargets] == undefined || !(int(__setPropDict[fishTargets]) >= 2 && int(__setPropDict[fishTargets]) <= 9))
         {
            __setPropDict[fishTargets] = currentFrame;
            __setProp_fishTargets_mcPinballMachine_FishTargets_2();
         }
         if(__setPropDict[guildTarget] == undefined || !(int(__setPropDict[guildTarget]) >= 2 && int(__setPropDict[guildTarget]) <= 9))
         {
            __setPropDict[guildTarget] = currentFrame;
            __setProp_guildTarget_mcPinballMachine_GuildTarget_2();
         }
         if(__setPropDict[gift15] == undefined || !(int(__setPropDict[gift15]) >= 2 && int(__setPropDict[gift15]) <= 9))
         {
            __setPropDict[gift15] = currentFrame;
            __setProp_gift15_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift14] == undefined || !(int(__setPropDict[gift14]) >= 2 && int(__setPropDict[gift14]) <= 9))
         {
            __setPropDict[gift14] = currentFrame;
            __setProp_gift14_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[cowTarget] == undefined || !(int(__setPropDict[cowTarget]) >= 2 && int(__setPropDict[cowTarget]) <= 9))
         {
            __setPropDict[cowTarget] = currentFrame;
            __setProp_cowTarget_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[gambinoSaucer] == undefined || !(int(__setPropDict[gambinoSaucer]) >= 2 && int(__setPropDict[gambinoSaucer]) <= 9))
         {
            __setPropDict[gambinoSaucer] = currentFrame;
            __setProp_gambinoSaucer_mcPinballMachine_GambinoSaucer_2();
         }
         if(__setPropDict[gambinoTargets] == undefined || !(int(__setPropDict[gambinoTargets]) >= 2 && int(__setPropDict[gambinoTargets]) <= 9))
         {
            __setPropDict[gambinoTargets] = currentFrame;
            __setProp_gambinoTargets_mcPinballMachine_GambinoTargets_2();
         }
         if(__setPropDict[slotsTargets] == undefined || !(int(__setPropDict[slotsTargets]) >= 2 && int(__setPropDict[slotsTargets]) <= 9))
         {
            __setPropDict[slotsTargets] = currentFrame;
            __setProp_slotsTargets_mcPinballMachine_SlotsTargets_2();
         }
         if(__setPropDict[fishBumper] == undefined || !(int(__setPropDict[fishBumper]) >= 2 && int(__setPropDict[fishBumper]) <= 9))
         {
            __setPropDict[fishBumper] = currentFrame;
            __setProp_fishBumper_mcPinballMachine_FishBumper_2();
         }
         if(__setPropDict[helsonSaucerExit] == undefined || !(int(__setPropDict[helsonSaucerExit]) >= 2 && int(__setPropDict[helsonSaucerExit]) <= 9))
         {
            __setPropDict[helsonSaucerExit] = currentFrame;
            __setProp_helsonSaucerExit_mcPinballMachine_Eject_2();
         }
         if(__setPropDict[kicker_rc] == undefined || !(int(__setPropDict[kicker_rc]) >= 2 && int(__setPropDict[kicker_rc]) <= 9))
         {
            __setPropDict[kicker_rc] = currentFrame;
            __setProp_kicker_rc_mcPinballMachine_FlipperZone_2();
         }
         if(__setPropDict[kicker_ra] == undefined || !(int(__setPropDict[kicker_ra]) >= 2 && int(__setPropDict[kicker_ra]) <= 9))
         {
            __setPropDict[kicker_ra] = currentFrame;
            __setProp_kicker_ra_mcPinballMachine_Arena_2();
         }
         if(__setPropDict[arenaBumper0] == undefined || !(int(__setPropDict[arenaBumper0]) >= 2 && int(__setPropDict[arenaBumper0]) <= 9))
         {
            __setPropDict[arenaBumper0] = currentFrame;
            __setProp_arenaBumper0_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[zurgTarget] == undefined || !(int(__setPropDict[zurgTarget]) >= 2 && int(__setPropDict[zurgTarget]) <= 9))
         {
            __setPropDict[zurgTarget] = currentFrame;
            __setProp_zurgTarget_mcPinballMachine_Zurg_2();
         }
         if(__setPropDict[arenaBumper1] == undefined || !(int(__setPropDict[arenaBumper1]) >= 2 && int(__setPropDict[arenaBumper1]) <= 9))
         {
            __setPropDict[arenaBumper1] = currentFrame;
            __setProp_arenaBumper1_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[__id3_] == undefined || !(int(__setPropDict[__id3_]) >= 2 && int(__setPropDict[__id3_]) <= 9))
         {
            __setPropDict[__id3_] = currentFrame;
            __setProp___id3__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[voteTargets] == undefined || !(int(__setPropDict[voteTargets]) >= 2 && int(__setPropDict[voteTargets]) <= 9))
         {
            __setPropDict[voteTargets] = currentFrame;
            __setProp_voteTargets_mcPinballMachine_VoteTargets_2();
         }
         if(__setPropDict[gift10] == undefined || !(int(__setPropDict[gift10]) >= 2 && int(__setPropDict[gift10]) <= 9))
         {
            __setPropDict[gift10] = currentFrame;
            __setProp_gift10_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift12] == undefined || !(int(__setPropDict[gift12]) >= 2 && int(__setPropDict[gift12]) <= 9))
         {
            __setPropDict[gift12] = currentFrame;
            __setProp_gift12_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift13] == undefined || !(int(__setPropDict[gift13]) >= 2 && int(__setPropDict[gift13]) <= 9))
         {
            __setPropDict[gift13] = currentFrame;
            __setProp_gift13_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift11] == undefined || !(int(__setPropDict[gift11]) >= 2 && int(__setPropDict[gift11]) <= 9))
         {
            __setPropDict[gift11] = currentFrame;
            __setProp_gift11_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[arenaBumper2] == undefined || !(int(__setPropDict[arenaBumper2]) >= 2 && int(__setPropDict[arenaBumper2]) <= 9))
         {
            __setPropDict[arenaBumper2] = currentFrame;
            __setProp_arenaBumper2_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[__id0_] == undefined || !(int(__setPropDict[__id0_]) >= 2 && int(__setPropDict[__id0_]) <= 9))
         {
            __setPropDict[__id0_] = currentFrame;
            __setProp___id0__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[gift2] == undefined || !(int(__setPropDict[gift2]) >= 2 && int(__setPropDict[gift2]) <= 9))
         {
            __setPropDict[gift2] = currentFrame;
            __setProp_gift2_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift6] == undefined || !(int(__setPropDict[gift6]) >= 2 && int(__setPropDict[gift6]) <= 9))
         {
            __setPropDict[gift6] = currentFrame;
            __setProp_gift6_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[rockpuppyTarget] == undefined || !(int(__setPropDict[rockpuppyTarget]) >= 2 && int(__setPropDict[rockpuppyTarget]) <= 9))
         {
            __setPropDict[rockpuppyTarget] = currentFrame;
            __setProp_rockpuppyTarget_mcPinballMachine_RockPuppy_2();
         }
         if(__setPropDict[__id2_] == undefined || !(int(__setPropDict[__id2_]) >= 2 && int(__setPropDict[__id2_]) <= 9))
         {
            __setPropDict[__id2_] = currentFrame;
            __setProp___id2__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[loganSaucer] == undefined || !(int(__setPropDict[loganSaucer]) >= 2 && int(__setPropDict[loganSaucer]) <= 9))
         {
            __setPropDict[loganSaucer] = currentFrame;
            __setProp_loganSaucer_mcPinballMachine_LoganSaucer_2();
         }
         if(__setPropDict[bot2Target] == undefined || !(int(__setPropDict[bot2Target]) >= 2 && int(__setPropDict[bot2Target]) <= 9))
         {
            __setPropDict[bot2Target] = currentFrame;
            __setProp_bot2Target_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[kicker_la] == undefined || !(int(__setPropDict[kicker_la]) >= 2 && int(__setPropDict[kicker_la]) <= 9))
         {
            __setPropDict[kicker_la] = currentFrame;
            __setProp_kicker_la_mcPinballMachine_Arena_2();
         }
         if(__setPropDict[__id4_] == undefined || !(int(__setPropDict[__id4_]) >= 2 && int(__setPropDict[__id4_]) <= 9))
         {
            __setPropDict[__id4_] = currentFrame;
            __setProp___id4__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[__id5_] == undefined || !(int(__setPropDict[__id5_]) >= 2 && int(__setPropDict[__id5_]) <= 9))
         {
            __setPropDict[__id5_] = currentFrame;
            __setProp___id5__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[gift3] == undefined || !(int(__setPropDict[gift3]) >= 2 && int(__setPropDict[gift3]) <= 9))
         {
            __setPropDict[gift3] = currentFrame;
            __setProp_gift3_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift7] == undefined || !(int(__setPropDict[gift7]) >= 2 && int(__setPropDict[gift7]) <= 9))
         {
            __setPropDict[gift7] = currentFrame;
            __setProp_gift7_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[bot1Target] == undefined || !(int(__setPropDict[bot1Target]) >= 2 && int(__setPropDict[bot1Target]) <= 9))
         {
            __setPropDict[bot1Target] = currentFrame;
            __setProp_bot1Target_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[grunnyTargets] == undefined || !(int(__setPropDict[grunnyTargets]) >= 2 && int(__setPropDict[grunnyTargets]) <= 9))
         {
            __setPropDict[grunnyTargets] = currentFrame;
            __setProp_grunnyTargets_mcPinballMachine_GrunnyTargets_2();
         }
         if(__setPropDict[safetySwitch] == undefined || !(int(__setPropDict[safetySwitch]) >= 2 && int(__setPropDict[safetySwitch]) <= 9))
         {
            __setPropDict[safetySwitch] = currentFrame;
            __setProp_safetySwitch_mcPinballMachine_LaunchAlley_2();
         }
         if(__setPropDict[gift4] == undefined || !(int(__setPropDict[gift4]) >= 2 && int(__setPropDict[gift4]) <= 9))
         {
            __setPropDict[gift4] = currentFrame;
            __setProp_gift4_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[__id1_] == undefined || !(int(__setPropDict[__id1_]) >= 2 && int(__setPropDict[__id1_]) <= 9))
         {
            __setPropDict[__id1_] = currentFrame;
            __setProp___id1__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[tradeTargets] == undefined || !(int(__setPropDict[tradeTargets]) >= 2 && int(__setPropDict[tradeTargets]) <= 9))
         {
            __setPropDict[tradeTargets] = currentFrame;
            __setProp_tradeTargets_mcPinballMachine_TradeTargets_2();
         }
         if(__setPropDict[gift9] == undefined || !(int(__setPropDict[gift9]) >= 2 && int(__setPropDict[gift9]) <= 9))
         {
            __setPropDict[gift9] = currentFrame;
            __setProp_gift9_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift8] == undefined || !(int(__setPropDict[gift8]) >= 2 && int(__setPropDict[gift8]) <= 9))
         {
            __setPropDict[gift8] = currentFrame;
            __setProp_gift8_mcPinballMachine_Gifts_2();
         }
      }
      
      internal function frame5() : *
      {
         if(__setPropDict[kicker_lc] == undefined || !(int(__setPropDict[kicker_lc]) >= 2 && int(__setPropDict[kicker_lc]) <= 9))
         {
            __setPropDict[kicker_lc] = currentFrame;
            __setProp_kicker_lc_mcPinballMachine_FlipperZone_2();
         }
         if(__setPropDict[gift5] == undefined || !(int(__setPropDict[gift5]) >= 2 && int(__setPropDict[gift5]) <= 9))
         {
            __setPropDict[gift5] = currentFrame;
            __setProp_gift5_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift1] == undefined || !(int(__setPropDict[gift1]) >= 2 && int(__setPropDict[gift1]) <= 9))
         {
            __setPropDict[gift1] = currentFrame;
            __setProp_gift1_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[fishTargets] == undefined || !(int(__setPropDict[fishTargets]) >= 2 && int(__setPropDict[fishTargets]) <= 9))
         {
            __setPropDict[fishTargets] = currentFrame;
            __setProp_fishTargets_mcPinballMachine_FishTargets_2();
         }
         if(__setPropDict[guildTarget] == undefined || !(int(__setPropDict[guildTarget]) >= 2 && int(__setPropDict[guildTarget]) <= 9))
         {
            __setPropDict[guildTarget] = currentFrame;
            __setProp_guildTarget_mcPinballMachine_GuildTarget_2();
         }
         if(__setPropDict[gift15] == undefined || !(int(__setPropDict[gift15]) >= 2 && int(__setPropDict[gift15]) <= 9))
         {
            __setPropDict[gift15] = currentFrame;
            __setProp_gift15_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift14] == undefined || !(int(__setPropDict[gift14]) >= 2 && int(__setPropDict[gift14]) <= 9))
         {
            __setPropDict[gift14] = currentFrame;
            __setProp_gift14_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[cowTarget] == undefined || !(int(__setPropDict[cowTarget]) >= 2 && int(__setPropDict[cowTarget]) <= 9))
         {
            __setPropDict[cowTarget] = currentFrame;
            __setProp_cowTarget_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[gambinoSaucer] == undefined || !(int(__setPropDict[gambinoSaucer]) >= 2 && int(__setPropDict[gambinoSaucer]) <= 9))
         {
            __setPropDict[gambinoSaucer] = currentFrame;
            __setProp_gambinoSaucer_mcPinballMachine_GambinoSaucer_2();
         }
         if(__setPropDict[gambinoTargets] == undefined || !(int(__setPropDict[gambinoTargets]) >= 2 && int(__setPropDict[gambinoTargets]) <= 9))
         {
            __setPropDict[gambinoTargets] = currentFrame;
            __setProp_gambinoTargets_mcPinballMachine_GambinoTargets_2();
         }
         if(__setPropDict[slotsTargets] == undefined || !(int(__setPropDict[slotsTargets]) >= 2 && int(__setPropDict[slotsTargets]) <= 9))
         {
            __setPropDict[slotsTargets] = currentFrame;
            __setProp_slotsTargets_mcPinballMachine_SlotsTargets_2();
         }
         if(__setPropDict[fishBumper] == undefined || !(int(__setPropDict[fishBumper]) >= 2 && int(__setPropDict[fishBumper]) <= 9))
         {
            __setPropDict[fishBumper] = currentFrame;
            __setProp_fishBumper_mcPinballMachine_FishBumper_2();
         }
         if(__setPropDict[helsonSaucerExit] == undefined || !(int(__setPropDict[helsonSaucerExit]) >= 2 && int(__setPropDict[helsonSaucerExit]) <= 9))
         {
            __setPropDict[helsonSaucerExit] = currentFrame;
            __setProp_helsonSaucerExit_mcPinballMachine_Eject_2();
         }
         if(__setPropDict[kicker_rc] == undefined || !(int(__setPropDict[kicker_rc]) >= 2 && int(__setPropDict[kicker_rc]) <= 9))
         {
            __setPropDict[kicker_rc] = currentFrame;
            __setProp_kicker_rc_mcPinballMachine_FlipperZone_2();
         }
         if(__setPropDict[kicker_ra] == undefined || !(int(__setPropDict[kicker_ra]) >= 2 && int(__setPropDict[kicker_ra]) <= 9))
         {
            __setPropDict[kicker_ra] = currentFrame;
            __setProp_kicker_ra_mcPinballMachine_Arena_2();
         }
         if(__setPropDict[arenaBumper0] == undefined || !(int(__setPropDict[arenaBumper0]) >= 2 && int(__setPropDict[arenaBumper0]) <= 9))
         {
            __setPropDict[arenaBumper0] = currentFrame;
            __setProp_arenaBumper0_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[zurgTarget] == undefined || !(int(__setPropDict[zurgTarget]) >= 2 && int(__setPropDict[zurgTarget]) <= 9))
         {
            __setPropDict[zurgTarget] = currentFrame;
            __setProp_zurgTarget_mcPinballMachine_Zurg_2();
         }
         if(__setPropDict[arenaBumper1] == undefined || !(int(__setPropDict[arenaBumper1]) >= 2 && int(__setPropDict[arenaBumper1]) <= 9))
         {
            __setPropDict[arenaBumper1] = currentFrame;
            __setProp_arenaBumper1_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[__id3_] == undefined || !(int(__setPropDict[__id3_]) >= 2 && int(__setPropDict[__id3_]) <= 9))
         {
            __setPropDict[__id3_] = currentFrame;
            __setProp___id3__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[voteTargets] == undefined || !(int(__setPropDict[voteTargets]) >= 2 && int(__setPropDict[voteTargets]) <= 9))
         {
            __setPropDict[voteTargets] = currentFrame;
            __setProp_voteTargets_mcPinballMachine_VoteTargets_2();
         }
         if(__setPropDict[gift10] == undefined || !(int(__setPropDict[gift10]) >= 2 && int(__setPropDict[gift10]) <= 9))
         {
            __setPropDict[gift10] = currentFrame;
            __setProp_gift10_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift12] == undefined || !(int(__setPropDict[gift12]) >= 2 && int(__setPropDict[gift12]) <= 9))
         {
            __setPropDict[gift12] = currentFrame;
            __setProp_gift12_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift13] == undefined || !(int(__setPropDict[gift13]) >= 2 && int(__setPropDict[gift13]) <= 9))
         {
            __setPropDict[gift13] = currentFrame;
            __setProp_gift13_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift11] == undefined || !(int(__setPropDict[gift11]) >= 2 && int(__setPropDict[gift11]) <= 9))
         {
            __setPropDict[gift11] = currentFrame;
            __setProp_gift11_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[arenaBumper2] == undefined || !(int(__setPropDict[arenaBumper2]) >= 2 && int(__setPropDict[arenaBumper2]) <= 9))
         {
            __setPropDict[arenaBumper2] = currentFrame;
            __setProp_arenaBumper2_mcPinballMachine_VoteBumpers_2();
         }
         if(__setPropDict[__id0_] == undefined || !(int(__setPropDict[__id0_]) >= 2 && int(__setPropDict[__id0_]) <= 9))
         {
            __setPropDict[__id0_] = currentFrame;
            __setProp___id0__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[gift2] == undefined || !(int(__setPropDict[gift2]) >= 2 && int(__setPropDict[gift2]) <= 9))
         {
            __setPropDict[gift2] = currentFrame;
            __setProp_gift2_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift6] == undefined || !(int(__setPropDict[gift6]) >= 2 && int(__setPropDict[gift6]) <= 9))
         {
            __setPropDict[gift6] = currentFrame;
            __setProp_gift6_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[rockpuppyTarget] == undefined || !(int(__setPropDict[rockpuppyTarget]) >= 2 && int(__setPropDict[rockpuppyTarget]) <= 9))
         {
            __setPropDict[rockpuppyTarget] = currentFrame;
            __setProp_rockpuppyTarget_mcPinballMachine_RockPuppy_2();
         }
         if(__setPropDict[__id2_] == undefined || !(int(__setPropDict[__id2_]) >= 2 && int(__setPropDict[__id2_]) <= 9))
         {
            __setPropDict[__id2_] = currentFrame;
            __setProp___id2__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[loganSaucer] == undefined || !(int(__setPropDict[loganSaucer]) >= 2 && int(__setPropDict[loganSaucer]) <= 9))
         {
            __setPropDict[loganSaucer] = currentFrame;
            __setProp_loganSaucer_mcPinballMachine_LoganSaucer_2();
         }
         if(__setPropDict[bot2Target] == undefined || !(int(__setPropDict[bot2Target]) >= 2 && int(__setPropDict[bot2Target]) <= 9))
         {
            __setPropDict[bot2Target] = currentFrame;
            __setProp_bot2Target_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[kicker_la] == undefined || !(int(__setPropDict[kicker_la]) >= 2 && int(__setPropDict[kicker_la]) <= 9))
         {
            __setPropDict[kicker_la] = currentFrame;
            __setProp_kicker_la_mcPinballMachine_Arena_2();
         }
         if(__setPropDict[__id4_] == undefined || !(int(__setPropDict[__id4_]) >= 2 && int(__setPropDict[__id4_]) <= 9))
         {
            __setPropDict[__id4_] = currentFrame;
            __setProp___id4__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[__id5_] == undefined || !(int(__setPropDict[__id5_]) >= 2 && int(__setPropDict[__id5_]) <= 9))
         {
            __setPropDict[__id5_] = currentFrame;
            __setProp___id5__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[gift3] == undefined || !(int(__setPropDict[gift3]) >= 2 && int(__setPropDict[gift3]) <= 9))
         {
            __setPropDict[gift3] = currentFrame;
            __setProp_gift3_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift7] == undefined || !(int(__setPropDict[gift7]) >= 2 && int(__setPropDict[gift7]) <= 9))
         {
            __setPropDict[gift7] = currentFrame;
            __setProp_gift7_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[bot1Target] == undefined || !(int(__setPropDict[bot1Target]) >= 2 && int(__setPropDict[bot1Target]) <= 9))
         {
            __setPropDict[bot1Target] = currentFrame;
            __setProp_bot1Target_mcPinballMachine_Cow_2();
         }
         if(__setPropDict[grunnyTargets] == undefined || !(int(__setPropDict[grunnyTargets]) >= 2 && int(__setPropDict[grunnyTargets]) <= 9))
         {
            __setPropDict[grunnyTargets] = currentFrame;
            __setProp_grunnyTargets_mcPinballMachine_GrunnyTargets_2();
         }
         if(__setPropDict[safetySwitch] == undefined || !(int(__setPropDict[safetySwitch]) >= 2 && int(__setPropDict[safetySwitch]) <= 9))
         {
            __setPropDict[safetySwitch] = currentFrame;
            __setProp_safetySwitch_mcPinballMachine_LaunchAlley_2();
         }
         if(__setPropDict[gift4] == undefined || !(int(__setPropDict[gift4]) >= 2 && int(__setPropDict[gift4]) <= 9))
         {
            __setPropDict[gift4] = currentFrame;
            __setProp_gift4_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[__id1_] == undefined || !(int(__setPropDict[__id1_]) >= 2 && int(__setPropDict[__id1_]) <= 9))
         {
            __setPropDict[__id1_] = currentFrame;
            __setProp___id1__mcPinballMachine_Shortcut_2();
         }
         if(__setPropDict[tradeTargets] == undefined || !(int(__setPropDict[tradeTargets]) >= 2 && int(__setPropDict[tradeTargets]) <= 9))
         {
            __setPropDict[tradeTargets] = currentFrame;
            __setProp_tradeTargets_mcPinballMachine_TradeTargets_2();
         }
         if(__setPropDict[gift9] == undefined || !(int(__setPropDict[gift9]) >= 2 && int(__setPropDict[gift9]) <= 9))
         {
            __setPropDict[gift9] = currentFrame;
            __setProp_gift9_mcPinballMachine_Gifts_2();
         }
         if(__setPropDict[gift8] == undefined || !(int(__setPropDict[gift8]) >= 2 && int(__setPropDict[gift8]) <= 9))
         {
            __setPropDict[gift8] = currentFrame;
            __setProp_gift8_mcPinballMachine_Gifts_2();
         }
      }
      
      internal function __setProp_gift9_mcPinballMachine_Gifts_2() : *
      {
         try
         {
            gift9["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gift9.__Active = true;
         gift9.__GroupQueue = "__HitQueue";
         gift9.__DropLevel = 1;
         gift9.__LightLevel = 1;
         gift9.__Location = "table";
         gift9.__ScoreLink = "giftBox";
         gift9.__SndEffectLevel = false;
         gift9.__SndEffectHit = "coinlight";
         gift9.__SndEffectUnhit = "none";
         gift9.__TargetType = "spot";
         try
         {
            gift9["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_r_flipper_c_mcPinballMachine_Flippers_1() : *
      {
         try
         {
            r_flipper_c["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         r_flipper_c.__Location = "table";
         r_flipper_c.__SndEffectFlip = "flip_right_up";
         r_flipper_c.__SndEffectUnflip = "flip_right_down";
         try
         {
            r_flipper_c["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_gift13_mcPinballMachine_Gifts_2() : *
      {
         try
         {
            gift13["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gift13.__Active = true;
         gift13.__GroupQueue = "__HitQueue";
         gift13.__DropLevel = 1;
         gift13.__LightLevel = 1;
         gift13.__Location = "table";
         gift13.__ScoreLink = "giftBox";
         gift13.__SndEffectLevel = false;
         gift13.__SndEffectHit = "coinlight";
         gift13.__SndEffectUnhit = "none";
         gift13.__TargetType = "spot";
         try
         {
            gift13["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_slotsTargets_mcPinballMachine_SlotsTargets_2() : *
      {
         try
         {
            slotsTargets["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         slotsTargets.__AutoPop = false;
         slotsTargets.__CompFuncStr = "slotsComplete";
         slotsTargets.__Location = "table";
         slotsTargets.__MaxDrops = 1;
         slotsTargets.__MaxLevel = 1;
         slotsTargets.__PopAudio = "none";
         slotsTargets.__PopupTime = 250;
         slotsTargets.__GroupScoreLink = "slotsTarget";
         slotsTargets.__GroupQueue = "__SlotsQueue";
         slotsTargets.__GroupTargetType = "spot";
         try
         {
            slotsTargets["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_rockpuppyTarget_mcPinballMachine_RockPuppy_2() : *
      {
         try
         {
            rockpuppyTarget["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         rockpuppyTarget.__AutoPop = false;
         rockpuppyTarget.__CompFuncStr = "rockpuppyHit";
         rockpuppyTarget.__Location = "table";
         rockpuppyTarget.__MaxDrops = 0;
         rockpuppyTarget.__MaxLevel = 1;
         rockpuppyTarget.__PopAudio = "none";
         rockpuppyTarget.__PopupTime = 250;
         rockpuppyTarget.__GroupScoreLink = "rockpuppyTarget";
         rockpuppyTarget.__GroupQueue = "__HitQueue";
         rockpuppyTarget.__GroupTargetType = "spot";
         try
         {
            rockpuppyTarget["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_kicker_la_mcPinballMachine_Arena_2() : *
      {
         try
         {
            kicker_la["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         kicker_la.__Location = "table";
         kicker_la.__SndEffect = "KickerElastic";
         try
         {
            kicker_la["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp___id3__mcPinballMachine_Shortcut_2() : *
      {
         try
         {
            __id3_["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         __id3_.__MyLocation = "table";
         __id3_.__OverDir = true;
         __id3_.__Power = 15;
         __id3_.__MySndEffect = "none";
         try
         {
            __id3_["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_gift4_mcPinballMachine_Gifts_2() : *
      {
         try
         {
            gift4["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gift4.__Active = true;
         gift4.__GroupQueue = "__HitQueue";
         gift4.__DropLevel = 1;
         gift4.__LightLevel = 1;
         gift4.__Location = "table";
         gift4.__ScoreLink = "giftBox";
         gift4.__SndEffectLevel = false;
         gift4.__SndEffectHit = "coinlight";
         gift4.__SndEffectUnhit = "none";
         gift4.__TargetType = "spot";
         try
         {
            gift4["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_kicker_ra_mcPinballMachine_Arena_2() : *
      {
         try
         {
            kicker_ra["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         kicker_ra.__Location = "table";
         kicker_ra.__SndEffect = "KickerElastic";
         try
         {
            kicker_ra["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_l_flipper_c_mcPinballMachine_Flippers_1() : *
      {
         try
         {
            l_flipper_c["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         l_flipper_c.__Location = "table";
         l_flipper_c.__SndEffectFlip = "flip_left_up";
         l_flipper_c.__SndEffectUnflip = "flip_left_down";
         try
         {
            l_flipper_c["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp___id2__mcPinballMachine_Shortcut_2() : *
      {
         try
         {
            __id2_["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         __id2_.__MyLocation = "table";
         __id2_.__OverDir = true;
         __id2_.__Power = 10;
         __id2_.__MySndEffect = "none";
         try
         {
            __id2_["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_cowTarget_mcPinballMachine_Cow_2() : *
      {
         try
         {
            cowTarget["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         cowTarget.__AutoPop = false;
         cowTarget.__CompFuncStr = "cowTipped";
         cowTarget.__Location = "table";
         cowTarget.__MaxDrops = 0;
         cowTarget.__MaxLevel = 1;
         cowTarget.__PopAudio = "none";
         cowTarget.__PopupTime = 250;
         cowTarget.__GroupScoreLink = "cow";
         cowTarget.__GroupQueue = "__HitQueue";
         cowTarget.__GroupTargetType = "spot";
         try
         {
            cowTarget["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_zurgTarget_mcPinballMachine_Zurg_2() : *
      {
         try
         {
            zurgTarget["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         zurgTarget.__AutoPop = false;
         zurgTarget.__CompFuncStr = "zurgShotDown";
         zurgTarget.__Location = "table";
         zurgTarget.__MaxDrops = 0;
         zurgTarget.__MaxLevel = 1;
         zurgTarget.__PopAudio = "none";
         zurgTarget.__PopupTime = 250;
         zurgTarget.__GroupScoreLink = "zurgTarget";
         zurgTarget.__GroupQueue = "__HitQueue";
         zurgTarget.__GroupTargetType = "spot";
         try
         {
            zurgTarget["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_gambinoTargets_mcPinballMachine_GambinoTargets_2() : *
      {
         try
         {
            gambinoTargets["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gambinoTargets.__AutoPop = true;
         gambinoTargets.__CompFuncStr = "gambinoComplete";
         gambinoTargets.__Location = "table";
         gambinoTargets.__MaxDrops = 1;
         gambinoTargets.__MaxLevel = 2;
         gambinoTargets.__PopAudio = "none";
         gambinoTargets.__PopupTime = 500;
         gambinoTargets.__GroupScoreLink = "gambinoTarget";
         gambinoTargets.__GroupQueue = "__GambinoQueue";
         gambinoTargets.__GroupTargetType = "drop";
         try
         {
            gambinoTargets["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_loganSaucer_mcPinballMachine_LoganSaucer_2() : *
      {
         try
         {
            loganSaucer["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         loganSaucer.__Active = true;
         loganSaucer.__EjectLocation = "this";
         loganSaucer.__EjectSpeedMax = 1;
         loganSaucer.__EjectSpeedMin = 10;
         loganSaucer.__FunctionString = "enterLoganSaucer";
         loganSaucer.__Location = "table";
         loganSaucer.__FuncArgs = ["null"];
         loganSaucer.__SndEffectEject = "none";
         loganSaucer.__SndEffectLock = "none";
         loganSaucer.__SaucerVis = true;
         loganSaucer.__SaucerType = "lock";
         loganSaucer.__CoreFunc = true;
         try
         {
            loganSaucer["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_gift8_mcPinballMachine_Gifts_2() : *
      {
         try
         {
            gift8["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gift8.__Active = true;
         gift8.__GroupQueue = "__HitQueue";
         gift8.__DropLevel = 1;
         gift8.__LightLevel = 1;
         gift8.__Location = "table";
         gift8.__ScoreLink = "giftBox";
         gift8.__SndEffectLevel = false;
         gift8.__SndEffectHit = "coinlight";
         gift8.__SndEffectUnhit = "none";
         gift8.__TargetType = "spot";
         try
         {
            gift8["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp___id1__mcPinballMachine_Shortcut_2() : *
      {
         try
         {
            __id1_["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         __id1_.__MyLocation = "table";
         __id1_.__OverDir = true;
         __id1_.__Power = 10;
         __id1_.__MySndEffect = "none";
         try
         {
            __id1_["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_gift12_mcPinballMachine_Gifts_2() : *
      {
         try
         {
            gift12["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gift12.__Active = true;
         gift12.__GroupQueue = "__HitQueue";
         gift12.__DropLevel = 1;
         gift12.__LightLevel = 1;
         gift12.__Location = "table";
         gift12.__ScoreLink = "giftBox";
         gift12.__SndEffectLevel = false;
         gift12.__SndEffectHit = "coinlight";
         gift12.__SndEffectUnhit = "none";
         gift12.__TargetType = "spot";
         try
         {
            gift12["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_grunnyTargets_mcPinballMachine_GrunnyTargets_2() : *
      {
         try
         {
            grunnyTargets["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         grunnyTargets.__AutoPop = true;
         grunnyTargets.__CompFuncStr = "grunnyComplete";
         grunnyTargets.__Location = "table";
         grunnyTargets.__MaxDrops = 0;
         grunnyTargets.__MaxLevel = 1;
         grunnyTargets.__PopAudio = "none";
         grunnyTargets.__PopupTime = 250;
         grunnyTargets.__GroupScoreLink = "grunnyTarget";
         grunnyTargets.__GroupQueue = "__GrunnyQueue";
         grunnyTargets.__GroupTargetType = "drop";
         try
         {
            grunnyTargets["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_guildTarget_mcPinballMachine_GuildTarget_2() : *
      {
         try
         {
            guildTarget["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         guildTarget.__AutoPop = false;
         guildTarget.__CompFuncStr = "startGuildEvent";
         guildTarget.__Location = "table";
         guildTarget.__MaxDrops = 1;
         guildTarget.__MaxLevel = 1;
         guildTarget.__PopAudio = "none";
         guildTarget.__PopupTime = 250;
         guildTarget.__GroupScoreLink = "guildTarget";
         guildTarget.__GroupQueue = "__HitQueue";
         guildTarget.__GroupTargetType = "spot";
         try
         {
            guildTarget["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_gift3_mcPinballMachine_Gifts_2() : *
      {
         try
         {
            gift3["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gift3.__Active = true;
         gift3.__GroupQueue = "__HitQueue";
         gift3.__DropLevel = 1;
         gift3.__LightLevel = 1;
         gift3.__Location = "table";
         gift3.__ScoreLink = "giftBox";
         gift3.__SndEffectLevel = false;
         gift3.__SndEffectHit = "coinlight";
         gift3.__SndEffectUnhit = "none";
         gift3.__TargetType = "spot";
         try
         {
            gift3["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp___id0__mcPinballMachine_Shortcut_2() : *
      {
         try
         {
            __id0_["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         __id0_.__Active = true;
         __id0_.__EffectTrigger = false;
         __id0_.__Location = "table";
         __id0_.__FuncArgs = ["null"];
         __id0_.__TriggerString = "takeShortcut";
         __id0_.__SndEffect = "none";
         __id0_.__CoreFunc = true;
         try
         {
            __id0_["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_voteTargets_mcPinballMachine_VoteTargets_2() : *
      {
         try
         {
            voteTargets["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         voteTargets.__AutoPop = true;
         voteTargets.__CompFuncStr = "voteComplete";
         voteTargets.__Location = "table";
         voteTargets.__MaxDrops = 4;
         voteTargets.__MaxLevel = 1;
         voteTargets.__PopAudio = "none";
         voteTargets.__PopupTime = 250;
         voteTargets.__GroupScoreLink = "voteTarget";
         voteTargets.__GroupQueue = "__VoteQueue";
         voteTargets.__GroupTargetType = "spot";
         try
         {
            voteTargets["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_fishBumper_mcPinballMachine_FishBumper_2() : *
      {
         try
         {
            fishBumper["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         fishBumper.__ArtLevel = 1;
         fishBumper.__Power = 3;
         fishBumper.__Location = "table";
         fishBumper.__ScoreLink = "fishBumper";
         fishBumper.__SndEffectLevel = false;
         fishBumper.__SndEffectHit = "fishbumper";
         try
         {
            fishBumper["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_gift7_mcPinballMachine_Gifts_2() : *
      {
         try
         {
            gift7["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gift7.__Active = true;
         gift7.__GroupQueue = "__HitQueue";
         gift7.__DropLevel = 1;
         gift7.__LightLevel = 1;
         gift7.__Location = "table";
         gift7.__ScoreLink = "giftBox";
         gift7.__SndEffectLevel = false;
         gift7.__SndEffectHit = "coinlight";
         gift7.__SndEffectUnhit = "none";
         gift7.__TargetType = "spot";
         try
         {
            gift7["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_gift11_mcPinballMachine_Gifts_2() : *
      {
         try
         {
            gift11["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gift11.__Active = true;
         gift11.__GroupQueue = "__HitQueue";
         gift11.__DropLevel = 1;
         gift11.__LightLevel = 1;
         gift11.__Location = "table";
         gift11.__ScoreLink = "giftBox";
         gift11.__SndEffectLevel = false;
         gift11.__SndEffectHit = "coinlight";
         gift11.__SndEffectUnhit = "none";
         gift11.__TargetType = "spot";
         try
         {
            gift11["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_bot2Target_mcPinballMachine_Cow_2() : *
      {
         try
         {
            bot2Target["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         bot2Target.__AutoPop = false;
         bot2Target.__CompFuncStr = "defaultFunction";
         bot2Target.__Location = "table";
         bot2Target.__MaxDrops = 0;
         bot2Target.__MaxLevel = 1;
         bot2Target.__PopAudio = "none";
         bot2Target.__PopupTime = 250;
         bot2Target.__GroupScoreLink = "bot2";
         bot2Target.__GroupQueue = "__HitQueue";
         bot2Target.__GroupTargetType = "spot";
         try
         {
            bot2Target["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_gift2_mcPinballMachine_Gifts_2() : *
      {
         try
         {
            gift2["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gift2.__Active = true;
         gift2.__GroupQueue = "__HitQueue";
         gift2.__DropLevel = 1;
         gift2.__LightLevel = 1;
         gift2.__Location = "table";
         gift2.__ScoreLink = "giftBox";
         gift2.__SndEffectLevel = false;
         gift2.__SndEffectHit = "coinlight";
         gift2.__SndEffectUnhit = "none";
         gift2.__TargetType = "spot";
         try
         {
            gift2["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_gift15_mcPinballMachine_Gifts_2() : *
      {
         try
         {
            gift15["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gift15.__Active = true;
         gift15.__GroupQueue = "__HitQueue";
         gift15.__DropLevel = 1;
         gift15.__LightLevel = 1;
         gift15.__Location = "table";
         gift15.__ScoreLink = "giftBox";
         gift15.__SndEffectLevel = false;
         gift15.__SndEffectHit = "coinlight";
         gift15.__SndEffectUnhit = "none";
         gift15.__TargetType = "spot";
         try
         {
            gift15["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_bot1Target_mcPinballMachine_Cow_2() : *
      {
         try
         {
            bot1Target["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         bot1Target.__AutoPop = false;
         bot1Target.__CompFuncStr = "defaultFunction";
         bot1Target.__Location = "table";
         bot1Target.__MaxDrops = 0;
         bot1Target.__MaxLevel = 1;
         bot1Target.__PopAudio = "none";
         bot1Target.__PopupTime = 250;
         bot1Target.__GroupScoreLink = "bot1";
         bot1Target.__GroupQueue = "__HitQueue";
         bot1Target.__GroupTargetType = "spot";
         try
         {
            bot1Target["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_gift6_mcPinballMachine_Gifts_2() : *
      {
         try
         {
            gift6["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gift6.__Active = true;
         gift6.__GroupQueue = "__HitQueue";
         gift6.__DropLevel = 1;
         gift6.__LightLevel = 1;
         gift6.__Location = "table";
         gift6.__ScoreLink = "giftBox";
         gift6.__SndEffectLevel = false;
         gift6.__SndEffectHit = "coinlight";
         gift6.__SndEffectUnhit = "none";
         gift6.__TargetType = "spot";
         try
         {
            gift6["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_helsonSaucerExit_mcPinballMachine_Eject_2() : *
      {
         try
         {
            helsonSaucerExit["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         helsonSaucerExit.__Active = true;
         helsonSaucerExit.__EjectLocation = "this";
         helsonSaucerExit.__EjectSpeedMax = 1;
         helsonSaucerExit.__EjectSpeedMin = 10;
         helsonSaucerExit.__FunctionString = "enterHelsonExit";
         helsonSaucerExit.__Location = "table";
         helsonSaucerExit.__SndEffectEject = "none";
         helsonSaucerExit.__SndEffectLock = "none";
         helsonSaucerExit.__SaucerVis = true;
         helsonSaucerExit.__SaucerType = "lock";
         helsonSaucerExit.__CoreFunc = true;
         try
         {
            helsonSaucerExit["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_gift10_mcPinballMachine_Gifts_2() : *
      {
         try
         {
            gift10["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gift10.__Active = true;
         gift10.__GroupQueue = "__HitQueue";
         gift10.__DropLevel = 1;
         gift10.__LightLevel = 1;
         gift10.__Location = "table";
         gift10.__ScoreLink = "giftBox";
         gift10.__SndEffectLevel = false;
         gift10.__SndEffectHit = "coinlight";
         gift10.__SndEffectUnhit = "none";
         gift10.__TargetType = "spot";
         try
         {
            gift10["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_gambinoSaucer_mcPinballMachine_GambinoSaucer_2() : *
      {
         try
         {
            gambinoSaucer["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gambinoSaucer.__Active = true;
         gambinoSaucer.__EjectLocation = "this";
         gambinoSaucer.__EjectSpeedMax = 1;
         gambinoSaucer.__EjectSpeedMin = 10;
         gambinoSaucer.__FunctionString = "enterGambinoSaucer";
         gambinoSaucer.__Location = "table";
         gambinoSaucer.__FuncArgs = ["null"];
         gambinoSaucer.__SndEffectEject = "none";
         gambinoSaucer.__SndEffectLock = "none";
         gambinoSaucer.__SaucerVis = true;
         gambinoSaucer.__SaucerType = "lock";
         gambinoSaucer.__CoreFunc = true;
         try
         {
            gambinoSaucer["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_fishTargets_mcPinballMachine_FishTargets_2() : *
      {
         try
         {
            fishTargets["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         fishTargets.__AutoPop = true;
         fishTargets.__CompFuncStr = "fishComplete";
         fishTargets.__Location = "table";
         fishTargets.__MaxDrops = 0;
         fishTargets.__MaxLevel = 9;
         fishTargets.__PopAudio = "resetfish";
         fishTargets.__PopupTime = 250;
         fishTargets.__GroupScoreLink = "fishTarget";
         fishTargets.__GroupQueue = "__FishQueue";
         fishTargets.__GroupTargetType = "drop";
         try
         {
            fishTargets["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_gift1_mcPinballMachine_Gifts_2() : *
      {
         try
         {
            gift1["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gift1.__Active = true;
         gift1.__GroupQueue = "__HitQueue";
         gift1.__DropLevel = 1;
         gift1.__LightLevel = 1;
         gift1.__Location = "table";
         gift1.__ScoreLink = "giftBox";
         gift1.__SndEffectLevel = false;
         gift1.__SndEffectHit = "coinlight";
         gift1.__SndEffectUnhit = "none";
         gift1.__TargetType = "spot";
         try
         {
            gift1["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_safetySwitch_mcPinballMachine_LaunchAlley_2() : *
      {
         try
         {
            safetySwitch["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         safetySwitch.__Active = true;
         safetySwitch.__EffectTrigger = false;
         safetySwitch.__Location = "table";
         safetySwitch.__FuncArgs = ["null"];
         safetySwitch.__TriggerString = "startSafeBall";
         safetySwitch.__SndEffect = "none";
         safetySwitch.__CoreFunc = true;
         try
         {
            safetySwitch["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_gift14_mcPinballMachine_Gifts_2() : *
      {
         try
         {
            gift14["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gift14.__Active = true;
         gift14.__GroupQueue = "__HitQueue";
         gift14.__DropLevel = 1;
         gift14.__LightLevel = 1;
         gift14.__Location = "table";
         gift14.__ScoreLink = "giftBox";
         gift14.__SndEffectLevel = false;
         gift14.__SndEffectHit = "coinlight";
         gift14.__SndEffectUnhit = "none";
         gift14.__TargetType = "spot";
         try
         {
            gift14["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_kicker_lc_mcPinballMachine_FlipperZone_2() : *
      {
         try
         {
            kicker_lc["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         kicker_lc.__Location = "table";
         kicker_lc.__SndEffect = "KickerElastic";
         try
         {
            kicker_lc["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_kicker_rc_mcPinballMachine_FlipperZone_2() : *
      {
         try
         {
            kicker_rc["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         kicker_rc.__Location = "table";
         kicker_rc.__SndEffect = "KickerElastic";
         try
         {
            kicker_rc["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
   }
}

