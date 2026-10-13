package com.gaiaonline.games.gPinball.uiscreens
{
   import com.gaiaonline.gameFramework.data.UserDataGlobal;
   import com.gaiaonline.games.gPinball.PinballCore;
   import flash.display.MovieClip;
   import flash.display.SimpleButton;
   import flash.events.Event;
   import flash.net.URLRequest;
   import flash.net.navigateToURL;
   import flash.text.TextFieldAutoSize;
   
   public class uiEndGame extends MovieClip
   {
      
      public var endDynamics:MovieClip;
      
      public var startButton:MovieClip;
      
      public var btnJoin:SimpleButton;
      
      public var __LedCountScoreDisplay:int = 9;
      
      private var __Awards:Object;
      
      public var btnClickBlocker:DialogueClickBlocker;
      
      public function uiEndGame()
      {
         super();
         addEventListener("enterFrame",init,false,0,true);
      }
      
      public function init(param1:Event) : void
      {
         var _loc2_:int = 0;
         var _loc3_:String = null;
         var _loc4_:String = null;
         var _loc5_:Number = NaN;
         var _loc6_:Number = NaN;
         btnClickBlocker = new DialogueClickBlocker();
         addChildAt(btnClickBlocker,0);
         removeEventListener("enterFrame",init);
         if(!UserDataGlobal.getInstance().isGuest() && PinballCore.__Gateway)
         {
            if(PinballCore.__Root.__AvatarItems != null)
            {
               __Awards = PinballCore.__Root.__AvatarItems;
            }
            endDynamics.awardField01.visible = false;
            endDynamics.awardField02.visible = false;
            endDynamics.awardField03.visible = false;
            endDynamics.awardField04.visible = false;
            _loc2_ = 0;
            for(_loc3_ in __Awards)
            {
               if(__Awards[_loc3_] != null)
               {
                  _loc2_++;
                  _loc4_ = "awardField0" + _loc2_;
                  endDynamics[_loc4_].text = __Awards[_loc3_];
                  endDynamics[_loc4_].visible = true;
               }
            }
            endDynamics.totalGold.text = PinballCore.__Root.getTotalGold();
            _loc5_ = Number(endDynamics.totalGold.width);
            _loc6_ = Number(endDynamics.goldpiece.width);
            endDynamics.totalGold.x = -((_loc5_ + _loc6_) / 2);
            endDynamics.goldpiece.x = (_loc5_ + _loc6_) / 2 - _loc6_;
            btnJoin.visible = false;
         }
         else
         {
            btnJoin.visible = true;
            endDynamics.totalGold.text = "Join Gaia to make friends & earn Gold!";
            btnJoin.addEventListener("mouseDown",doJoinURL,false,0,true);
            _loc2_ = 5;
         }
         endDynamics.totalGold.autoSize = TextFieldAutoSize.CENTER;
         setEndScore(PinballCore.__Table.cur_player.score);
         startButton.addEventListener("mouseDown",doStartClick,false,0,true);
         gotoAndStop(_loc2_ + 1);
      }
      
      public function doStartClick(param1:Event) : void
      {
         startButton.removeEventListener("mouseDown",doStartClick);
         PinballCore.__Root.newGame();
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[EndGameUI]",param1);
      }
      
      public function doJoinURL(param1:Event) : void
      {
         var _loc2_:URLRequest = null;
         _loc2_ = new URLRequest("http://www.gaiaonline.com/register");
         navigateToURL(_loc2_,"_blank");
      }
      
      public function setEndScore(param1:int) : void
      {
         var _loc2_:String = null;
         var _loc3_:String = null;
         var _loc4_:int = 0;
         var _loc5_:int = 0;
         _loc2_ = param1.toString();
         _loc4_ = 0;
         while(_loc4_ < __LedCountScoreDisplay)
         {
            endDynamics.score1["lcd" + _loc4_].gotoAndStop("ON");
            _loc5_ = _loc2_.length - 1 - _loc4_;
            if(_loc5_ >= 0)
            {
               _loc3_ = _loc2_.charAt(_loc5_);
            }
            else
            {
               _loc3_ = "";
            }
            endDynamics.score1["lcd" + _loc4_].lcdNumber.txt_number.text = _loc3_;
            _loc4_++;
         }
      }
   }
}

