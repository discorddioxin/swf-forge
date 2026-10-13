package com.gaiaonline.games.gPinball.compound_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.simple_elements.Booster;
   import com.gaiaonline.games.gPinball.simple_elements.Obstacle;
   import flash.display.DisplayObject;
   import flash.display.MovieClip;
   import flash.events.Event;
   
   public class ToggleGroup extends MovieClip
   {
      
      public var helsonSaucer:MovieClip;
      
      public var __Location:String = "table";
      
      public var __FirstRun:Boolean = true;
      
      public function ToggleGroup()
      {
         super();
         addEventListener("enterFrame",init,false,0,true);
      }
      
      public function makeUnready() : void
      {
         var _loc1_:int = 0;
         var _loc2_:DisplayObject = null;
         _loc1_ = 0;
         while(_loc1_ < numChildren)
         {
            _loc2_ = getChildAt(_loc1_);
            if(_loc2_ is Booster)
            {
               (_loc2_ as Booster).setActive(false);
            }
            else if(_loc2_ is Obstacle)
            {
               (_loc2_ as Obstacle).setActive(false);
            }
            else if(_loc2_ is Saucer)
            {
               (_loc2_ as Saucer).setActive(false);
            }
            _loc1_++;
         }
      }
      
      public function activate() : void
      {
         var _loc1_:int = 0;
         var _loc2_:DisplayObject = null;
         visible = true;
         _loc1_ = 0;
         while(_loc1_ < numChildren)
         {
            _loc2_ = getChildAt(_loc1_);
            if(_loc2_ is Obstacle)
            {
               (_loc2_ as Obstacle).setActive(true);
            }
            else if(_loc2_ is Booster)
            {
               (_loc2_ as Booster).setActive(true);
            }
            _loc1_++;
         }
         gotoAndPlay("show");
      }
      
      public function init(param1:Event) : void
      {
         var _loc2_:int = 0;
         var _loc3_:DisplayObject = null;
         removeEventListener("enterFrame",init);
         visible = false;
         _loc2_ = 0;
         while(_loc2_ < numChildren)
         {
            _loc3_ = getChildAt(_loc2_);
            if(_loc3_ is Booster)
            {
               (_loc3_ as Booster).setActive(false);
            }
            else if(_loc3_ is Obstacle)
            {
               if(__FirstRun)
               {
                  (_loc3_ as Obstacle).init(PinballCore.__Table.default_obst_decay,0,__Location,null,0);
               }
               (_loc3_ as Obstacle).setActive(false);
            }
            else if(_loc3_ is Saucer)
            {
               (_loc3_ as Saucer).setActive(false);
            }
            _loc2_++;
         }
         __FirstRun = false;
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[ToggleGroup]",param1);
      }
      
      public function makeReady() : void
      {
         var _loc1_:int = 0;
         var _loc2_:DisplayObject = null;
         _loc1_ = 0;
         while(_loc1_ < numChildren)
         {
            _loc2_ = getChildAt(_loc1_);
            if(_loc2_ is Saucer)
            {
               (_loc2_ as Saucer).setActive(true);
            }
            _loc1_++;
         }
      }
      
      public function deactivate(param1:Boolean) : void
      {
         if(param1)
         {
            visible = false;
            gotoAndStop("invis");
            return;
         }
         makeUnready();
         if(currentLabel != "invis")
         {
            gotoAndPlay("hide");
         }
      }
   }
}

