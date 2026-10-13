package com.gaiaonline.games.gPinball.compound_elements
{
   import com.custom.KeyCheck;
   import com.gaiaonline.games.gPinball.PinballCore;
   import com.gaiaonline.games.gPinball.simple_elements.Obstacle;
   import flash.display.MovieClip;
   import flash.events.Event;
   import flash.events.KeyboardEvent;
   import flash.utils.clearInterval;
   import flash.utils.setInterval;
   
   public class LaunchPlunger extends MovieClip
   {
      
      public var active:Boolean;
      
      public var art:MovieClip;
      
      public var __SndEffect:String = "none";
      
      public var obst:Obstacle;
      
      public var max_frame:uint = 25;
      
      public var plunge_efm_id:int = 0;
      
      public var plunge_power:int;
      
      public var reset_int:int;
      
      public function LaunchPlunger()
      {
         super();
         addEventListener("enterFrame",init,false,0,true);
      }
      
      public function plungerKeyDown(param1:KeyboardEvent) : void
      {
         if(PinballCore.__KeyboardIO)
         {
            if(param1.keyCode == PinballCore.__Table.plungekey && !active)
            {
               active = true;
               PinballCore.__Root.playSound("pullplunger");
               startPlunger();
            }
         }
      }
      
      public function init(param1:Event) : void
      {
         removeEventListener("enterFrame",init);
         obst.init(0.6,0,"table",null,0);
         stage.removeEventListener(KeyboardEvent.KEY_DOWN,plungerKeyDown);
         stage.addEventListener(KeyboardEvent.KEY_DOWN,plungerKeyDown,false,0,true);
      }
      
      public function dTrace(param1:String) : void
      {
         PinballCore.dTrace("[LaunchPlunger]",param1);
      }
      
      public function reset() : void
      {
         obst.setPower(0,0);
         clearInterval(reset_int);
      }
      
      public function plungerRelease() : void
      {
         var _loc1_:Number = NaN;
         PinballCore.__Root.playSound("plungershoot");
         PinballCore.__EFM.removeFunction(plunge_efm_id);
         plunge_efm_id = 0;
         art.gotoAndStop(1);
         _loc1_ = plunge_power <= 2 ? plunge_power : plunge_power - 2;
         obst.setPower(plunge_power,_loc1_);
         clearInterval(reset_int);
         reset_int = setInterval(reset,20);
         if(__SndEffect != "none" && __SndEffect != null)
         {
            PinballCore.__Root.playSound(__SndEffect);
         }
      }
      
      public function plungerKeyUp(param1:Event) : void
      {
         if(active)
         {
            active = false;
            plungerRelease();
         }
      }
      
      public function movePlunger() : void
      {
         if(art.currentFrame < max_frame)
         {
            art.gotoAndStop(art.currentFrame + 1);
            plunge_power += 1;
         }
         if(!KeyCheck.isDown(PinballCore.__Table.plungekey))
         {
            plungerKeyUp(null);
         }
      }
      
      public function startPlunger() : void
      {
         plunge_power = 0;
         if(plunge_efm_id == 0)
         {
            PinballCore.__EFM.removeFunction(plunge_efm_id);
            plunge_efm_id = PinballCore.__EFM.addFunction(this,"movePlunger");
         }
      }
   }
}

