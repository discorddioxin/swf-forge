package com.gaiaonline.games.gPinball.compound_elements
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.simple_elements.Brake;
   import com.gaiaonline.games.gPinball.simple_elements.Obstacle;
   import com.gaiaonline.games.gPinball.simple_elements.Trigger;
   import flash.display.DisplayObject;
   import flash.display.MovieClip;
   import flash.events.Event;
   
   public class Ramp extends MovieClip
   {
      
      public var __Active:Boolean;
      
      public var __InitFunc:Function;
      
      public var __HasScore:Boolean;
      
      public var enter_ramp:Trigger;
      
      public var endbrake:Brake;
      
      public var enter_out:Trigger;
      
      public var outer:MovieClip;
      
      public var saucers:MovieClip;
      
      public var exit_ramp:Trigger;
      
      public var score_ramp:Trigger;
      
      public var __HasBrake:Boolean;
      
      public var __Location:String;
      
      public function Ramp()
      {
         super();
         addEventListener("addedToStage",initA,false,0,true);
      }
      
      public function initA(param1:Event) : void
      {
         var _loc2_:int = 0;
         var _loc3_:int = 0;
         var _loc4_:DisplayObject = null;
         removeEventListener("addedToStage",initA);
         PinballCore.__Table[name] = this;
         _loc2_ = 1;
         while(_loc2_ <= PinballCore.__Table.total_sections)
         {
            PinballCore.__Table[__Location + "_obstacles" + _loc2_] = new Array();
            _loc2_++;
         }
         PinballCore.__Table[__Location + "_triggers"] = new Array();
         PinballCore.__Table[__Location + "_brakes"] = new Array();
         _loc3_ = 0;
         while(_loc3_ < outer.numChildren)
         {
            _loc4_ = outer.getChildAt(_loc3_);
            if(_loc4_ is Obstacle)
            {
               (_loc4_ as Obstacle).init(PinballCore.__Table.default_obst_decay,0,__Location,null,0);
            }
            _loc3_++;
         }
         _loc3_ = 0;
         while(_loc3_ < numChildren)
         {
            _loc4_ = getChildAt(_loc3_);
            if(_loc4_ is Obstacle)
            {
               (_loc4_ as Obstacle).init(PinballCore.__Table.default_obst_decay,0,"table",null,0);
            }
            _loc3_++;
         }
         if(__HasBrake)
         {
            endbrake.init(0.8,__Location);
         }
         if(__InitFunc != null)
         {
            __InitFunc();
         }
         if(name != "helsonramp")
         {
            __Active = true;
         }
         else
         {
            __Active = false;
         }
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[Ramp]",param1);
      }
   }
}

