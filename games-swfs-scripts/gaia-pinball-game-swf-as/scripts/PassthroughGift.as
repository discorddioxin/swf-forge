package
{
   import com.gaiaonline.games.gPinball.compound_elements.TargetPickup;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1137")]
   public dynamic class PassthroughGift extends TargetPickup
   {
      
      public var __id7_:PinballTrigger;
      
      public var __id10_:PinballTrigger;
      
      public var __id8_:PinballTrigger;
      
      public var __id9_:PinballTrigger;
      
      public function PassthroughGift()
      {
         super();
         __setProp___id9__mcTargetPassthroughGift_targetObstacle_1();
         __setProp___id7__mcTargetPassthroughGift_targetObstacle_1();
         __setProp___id10__mcTargetPassthroughGift_targetObstacle_1();
         __setProp___id8__mcTargetPassthroughGift_targetObstacle_1();
      }
      
      internal function __setProp___id7__mcTargetPassthroughGift_targetObstacle_1() : *
      {
         try
         {
            __id7_["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         __id7_.__Active = true;
         __id7_.__EffectTrigger = false;
         __id7_.__Location = "useParent";
         __id7_.__FuncArgs = ["null"];
         __id7_.__TriggerString = "hitTarget";
         __id7_.__SndEffect = "none";
         __id7_.__CoreFunc = false;
         try
         {
            __id7_["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp___id10__mcTargetPassthroughGift_targetObstacle_1() : *
      {
         try
         {
            __id10_["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         __id10_.__Active = true;
         __id10_.__EffectTrigger = false;
         __id10_.__Location = "table";
         __id10_.__FuncArgs = ["null"];
         __id10_.__TriggerString = "hitTarget";
         __id10_.__SndEffect = "none";
         __id10_.__CoreFunc = false;
         try
         {
            __id10_["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp___id9__mcTargetPassthroughGift_targetObstacle_1() : *
      {
         try
         {
            __id9_["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         __id9_.__Active = true;
         __id9_.__EffectTrigger = false;
         __id9_.__Location = "table";
         __id9_.__FuncArgs = ["null"];
         __id9_.__TriggerString = "hitTarget";
         __id9_.__SndEffect = "none";
         __id9_.__CoreFunc = false;
         try
         {
            __id9_["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp___id8__mcTargetPassthroughGift_targetObstacle_1() : *
      {
         try
         {
            __id8_["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         __id8_.__Active = true;
         __id8_.__EffectTrigger = false;
         __id8_.__Location = "table";
         __id8_.__FuncArgs = ["null"];
         __id8_.__TriggerString = "hitTarget";
         __id8_.__SndEffect = "none";
         __id8_.__CoreFunc = false;
         try
         {
            __id8_["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
   }
}

