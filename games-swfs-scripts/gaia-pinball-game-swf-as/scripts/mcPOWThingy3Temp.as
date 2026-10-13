package
{
   import com.gaiaonline.games.gPinball.simple_elements.InventoryItem;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol921")]
   public dynamic class mcPOWThingy3Temp extends InventoryItem
   {
      
      public function mcPOWThingy3Temp()
      {
         super();
         addFrameScript(0,frame1,4,frame5,8,frame9);
      }
      
      internal function frame1() : *
      {
         stop();
      }
      
      internal function frame5() : *
      {
         stop();
      }
      
      internal function frame9() : *
      {
         gotoAndStop(1);
      }
   }
}

